import os
import json
import random
import sys
from time import sleep
from typing import Sequence, Mapping, Any, Union
import torch
import http.server
import socketserver
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs


PORT = 8000  # You can change this to any available port you prefer


def get_value_at_index(obj: Union[Sequence, Mapping], index: int) -> Any:
    """Returns the value at the given index of a sequence or mapping.

    If the object is a sequence (like list or string), returns the value at the given index.
    If the object is a mapping (like a dictionary), returns the value at the index-th key.

    Some return a dictionary, in these cases, we look for the "results" key

    Args:
        obj (Union[Sequence, Mapping]): The object to retrieve the value from.
        index (int): The index of the value to retrieve.

    Returns:
        Any: The value at the given index.

    Raises:
        IndexError: If the index is out of bounds for the object and the object is not a mapping.
    """
    try:
        return obj[index]
    except KeyError:
        return obj["result"][index]


def find_path(name: str, path: str = None) -> str:
    """
    Recursively looks at parent folders starting from the given path until it finds the given name.
    Returns the path as a Path object if found, or None otherwise.
    """
    # If no path is given, use the current working directory
    if path is None:
        path = os.getcwd()

    # Check if the current directory contains the name
    if name in os.listdir(path):
        path_name = os.path.join(path, name)
        print(f"{name} found: {path_name}")
        return path_name

    # Get the parent directory
    parent_directory = os.path.dirname(path)

    # If the parent directory is the same as the current directory, we've reached the root and stop the search
    if parent_directory == path:
        return None

    # Recursively call the function with the parent directory
    return find_path(name, parent_directory)


def add_comfyui_directory_to_sys_path() -> None:
    """
    Add 'ComfyUI' to the sys.path
    """
    comfyui_path = find_path("ComfyUI")
    if comfyui_path is not None and os.path.isdir(comfyui_path):
        sys.path.append(comfyui_path)
        print(f"'{comfyui_path}' added to sys.path")


def add_extra_model_paths() -> None:
    """
    Parse the optional extra_model_paths.yaml file and add the parsed paths to the sys.path.
    """
    from main import load_extra_path_config

    extra_model_paths = find_path("extra_model_paths.yaml")

    if extra_model_paths is not None:
        load_extra_path_config(extra_model_paths)
    else:
        print("Could not find the extra_model_paths config file.")


add_comfyui_directory_to_sys_path()
add_extra_model_paths()


def import_custom_nodes() -> None:
    """Find all custom nodes in the custom_nodes folder and add those node objects to NODE_CLASS_MAPPINGS

    This function sets up a new asyncio event loop, initializes the PromptServer,
    creates a PromptQueue, and initializes the custom nodes.
    """
    import asyncio
    import execution
    from nodes import init_custom_nodes
    import server

    # Creating a new event loop and setting it as the default loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Creating an instance of PromptServer with the loop
    server_instance = server.PromptServer(loop)
    execution.PromptQueue(server_instance)

    # Initializing custom nodes
    init_custom_nodes()


from nodes import (
    CheckpointLoaderSimple,
    NODE_CLASS_MAPPINGS,
    DualCLIPLoader,
    KSampler,
    VAEDecode,
    CLIPTextEncode,
    SaveImage,
)


def main(prompts):
    import_custom_nodes()
    with torch.inference_mode():
        checkpointloadersimple = CheckpointLoaderSimple()
        checkpointloadersimple_4 = checkpointloadersimple.load_checkpoint(
            ckpt_name="sd3_medium.safetensors"
        )

        dualcliploader = DualCLIPLoader()
        dualcliploader_42 = dualcliploader.load_clip(
            clip_name1="clip_l.safetensors", clip_name2="clip_g.safetensors", type="sd3"
        )

        cliptextencode = CLIPTextEncode()
        emptysd3latentimage = NODE_CLASS_MAPPINGS["EmptySD3LatentImage"]()
        emptysd3latentimage_53 = emptysd3latentimage.generate(
            width=512, height=911, batch_size=1
        )

        ksampler = KSampler()
        vaedecode = VAEDecode()
        saveimage = SaveImage()

        cliptextencode_40 = cliptextencode.encode(
            text="", clip=get_value_at_index(dualcliploader_42, 0)
        )

        # class Handler(http.server.SimpleHTTPRequestHandler):
        #     def do_GET(self) -> None:
        #         parsed_url = urlparse(self.path)
        #         query_params = parse_qs(parsed_url.query)

        #         print(query_params)
        response={"paths": []}
        for prompt in prompts.split(","):
            cliptextencode_16 = cliptextencode.encode(
                text=f"{prompt} & vibrant and colorful no logo and no text and no finger close-ups"
                or "Nepali woman in Pashupatinath Temple",
                clip=get_value_at_index(dualcliploader_42, 0),
            )

            ksampler_3 = ksampler.sample(
                seed=random.randint(1, 2**64),
                steps=30,
                cfg=5.45,
                sampler_name="euler",
                scheduler="simple",
                denoise=1,
                model=get_value_at_index(checkpointloadersimple_4, 0),
                positive=get_value_at_index(cliptextencode_16, 0),
                negative=get_value_at_index(cliptextencode_40, 0),
                latent_image=get_value_at_index(emptysd3latentimage_53, 0),
            )

            vaedecode_8 = vaedecode.decode(
                samples=get_value_at_index(ksampler_3, 0),
                vae=get_value_at_index(checkpointloadersimple_4, 2),
            )

            saveimage_9 = saveimage.save_images(
                filename_prefix="ComfyUI", images=get_value_at_index(vaedecode_8, 0)
            )

            # Serialize dictionary to JSON
            response["paths"]= response["paths"] + [x["filename"] for x in saveimage_9["ui"]["images"]]

            
        json_response=json.dumps(response)
        print(json_response)

        # Send response headers
        # self.send_response(200)
        # self.send_header("Content-type", "application/json")
        # self.end_headers()

        # # Send JSON data
        # self.wfile.write(json_response.encode())

        return saveimage_9


if __name__ == "__main__":
    raw_prompts = input()
    prompts = raw_prompts.split(",")

    print("========================================================")
    print("THE PROMPT LENGTH IS HERE =============>>>>>>>>>>>", len(prompts))
    print("========================================================")

    print("received prompts:", prompts)
    main(raw_prompts)
