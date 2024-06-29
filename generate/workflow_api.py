import http.server
import json
import os
import random
import socketserver
import sys
from time import sleep
from typing import Sequence, Mapping, Any, Union
from urllib.parse import parse_qs, urlparse
import torch


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


from nodes import NODE_CLASS_MAPPINGS, KSampler, LoadImage, VAEDecode


def main(img_paths):
    import_custom_nodes()
    with torch.inference_mode():
        imageonlycheckpointloader = NODE_CLASS_MAPPINGS["ImageOnlyCheckpointLoader"]()
        imageonlycheckpointloader_15 = imageonlycheckpointloader.load_checkpoint(
            ckpt_name="svd.safetensors"
        )

        loadimage = LoadImage()
        svd_img2vid_conditioning = NODE_CLASS_MAPPINGS["SVD_img2vid_Conditioning"]()


        videolinearcfgguidance = NODE_CLASS_MAPPINGS["VideoLinearCFGGuidance"]()
        ksampler = KSampler()
        vaedecode = VAEDecode()
        saveanimatedwebp = NODE_CLASS_MAPPINGS["SaveAnimatedWEBP"]()

        videolinearcfgguidance_14 = videolinearcfgguidance.patch(
            min_cfg=1, model=get_value_at_index(imageonlycheckpointloader_15, 0)
        )

        # class Handler(http.server.SimpleHTTPRequestHandler):
        #     def do_GET(self) -> None:
        #         parsed_url = urlparse(self.path)
        #         query_params = parse_qs(parsed_url.query)

        #         print(query_params)
        response= {"paths": []}
        for img_path in img_paths.split(","):
            loadimage_23 = loadimage.load_image(image=img_path)

            svd_img2vid_conditioning_12 = svd_img2vid_conditioning.encode(
                width=432,
                height=768,
                video_frames=14,
                motion_bucket_id=127,
                fps=6,
                augmentation_level=0.2,
                clip_vision=get_value_at_index(imageonlycheckpointloader_15, 1),
                init_image=get_value_at_index(loadimage_23, 0),
                vae=get_value_at_index(imageonlycheckpointloader_15, 2),
            )

            ksampler_3 = ksampler.sample(
                seed=391247136435487,
                steps=30,
                cfg=2.5,
                sampler_name="euler",
                scheduler="karras",
                denoise=1,
                model=get_value_at_index(videolinearcfgguidance_14, 0),
                positive=get_value_at_index(svd_img2vid_conditioning_12, 0),
                negative=get_value_at_index(svd_img2vid_conditioning_12, 1),
                latent_image=get_value_at_index(svd_img2vid_conditioning_12, 2),
            )

            vaedecode_8 = vaedecode.decode(
                samples=get_value_at_index(ksampler_3, 0),
                vae=get_value_at_index(imageonlycheckpointloader_15, 2),
            )

            saveanimatedwebp_10 = saveanimatedwebp.save_images(
                filename_prefix="ComfyUI",
                fps=10,
                lossless=False,
                quality=100,
                method="default",
                images=get_value_at_index(vaedecode_8, 0),
            )

            # print(saveanimatedwebp_10)
            response["paths"]= response["paths"] + [x["filename"] for x in saveanimatedwebp_10["ui"]["images"]]
        json_response = json.dumps(
            response
        )
        print(json_response)

                # Send response headers
                # self.send_response(200)
                # self.send_header("Content-type", "application/json")
                # self.end_headers()

                # # Send JSON data
                # self.wfile.write(json_response.encode())

        return saveanimatedwebp_10

        PORT=8001
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print("Serving at port", PORT)

            server_started = False
            while (not server_started):
                try:
                    httpd.serve_forever()
                    server_started = True
                except Exception as e:
                    print(e)
                    sleep(10)

if __name__ == "__main__":
    img_paths = input()
    print("received img_paths:", img_paths.split(","))
    main(img_paths)
