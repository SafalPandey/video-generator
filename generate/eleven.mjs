import fetch from 'node-fetch';
import fs from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import transcriptFunction from './transcript.mjs';
import { writeFile } from 'fs/promises';
import { query } from './dbClient.mjs';

dotenv.config();

import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const VOICE_ID_MAP = {
	'JOE_ROGAN': 'joe-rogan',
	'KANYE_WEST': 'kanye-west',
	'BEN_SHAPIRO': 'ben-shapiro',
	'ANDREW_TATE': 'andrew-tate',
	'DONALD_TRUMP': 'donald-trump',
	'MARK_ZUCKERBERG': 'mark-zuckerberg',
	'JOE_BIDEN': 'joe-biden',
	'LIL_WAYNE': 'lil-wayne',
	'BEN_AFFLECK': 'ben-affleck',
	'ALEX_JONES': 'alex-jones',
	'DRAKE': 'drake',
	'ELON_MUSK': 'elon-musk',
	'JUSTIN_BIEBER': 'justin-bieber',
	'LEX_FRIDMAN': 'lex-fridman',
	'ROBERT_DOWNEY_JR': 'robert-downey-jr',
	'BILL_GATES': 'bill-gates',
	'DARTH_VADER': 'darth-vader',
	'BEYONCE': 'beyonce',
	'ARTIFICIAL_GENERAL_INTELLIGENCE aka A.G.I': 'sam-altman',
	'JORDAN_PETERSON': 'jordan-peterson'
}

export async function generateTranscriptAudio(
	local,
	topic,
	agentA,
	agentB,
	ai,
	fps,
	duration,
	background,
	music,
	videoId
) {
	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Generating transcript', progress = 0 WHERE video_id = ?",
			[videoId]
		);
	}

	let { transcript: { transcript }, videoTitle } = await transcriptFunction(topic, agentA, agentB, duration);

	const audios = [];

	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Fetching images', progress = 5 WHERE video_id = ?",
			[videoId]
		);
	}

	const images = await fetchValidImages(
		transcript,
		transcript.length,
		ai,
		duration
	);

	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Generating audio', progress = 12 WHERE video_id = ?",
			[videoId]
		);
	}

	for (let i = 0; i < transcript.length; i++) {
		const person = transcript[i].person;
		const line = transcript[i].line;
		const code = transcript[i].code;

		const voice_id = VOICE_ID_MAP[person]

		await generateAudio(voice_id, person, line, i);
		console.log(images?.[i], "IMIAGES[i]")
		audios.push({
			person: person,
			audio: `public/voice/${person}-${i}.mp3`,
			index: i,
			code,
			images:
				ai && duration === 1
					? images?.[i]?.["paths"] || 'https://images.smart.wtf/black.png'
					// && `data:image/jpeg;charset=utf-8;base64, ${images?.[i]?.images?.[0]}` 
					: images?.[i] || 'https://images.smart.wtf/black.png',
		});
	}

	const initialAgentName = audios[0].person;

	const contextContent = `
import { staticFile } from 'remotion';

export const music: string = ${music === 'NONE' ? `'NONE'` : `'/music/${music}.MP3'`
		};
export const fps = ${fps};
export const initialAgentName = '${initialAgentName}';
export const videoFileName = '/background/${background}-' + ${Math.floor(
			Math.random() * 10
		)} + '.mp4';
export const subtitlesFileName = [
  ${audios
			.map(
				(entry, i) => `{
    name: '${entry.person}',
    file: staticFile('srt/${entry.person}-${i}.srt'),
    asset: '${JSON.stringify(entry.images)}',
	code: \`${entry.code.replaceAll("\`", "\\\`").replaceAll("$", "\\$").replaceAll(";", ";\n")}\`,
  }`
			)
			.join(',\n  ')}
];
`;

	await writeFile('src/tmp/context.tsx', contextContent, 'utf-8');

	return { audios, transcript, videoTitle };
}

export async function generateAudio(voice_id, person, line, index) {
	const response = await fetch('https://api.neets.ai/v1/tts', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': process.env.NEETS_API_KEY,
		},
		body: JSON.stringify({
			text: line,
			voice_id: voice_id,
			params: {
				model: 'ar-diff-50k',
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Server responded with status code ${response.status}`);
	}

	const audioStream = fs.createWriteStream(
		`public/voice/${person}-${index}.mp3`
	);
	response.body.pipe(audioStream);

	return new Promise((resolve, reject) => {
		audioStream.on('finish', () => {
			resolve('Audio file saved as output.mp3');
		});
		audioStream.on('error', reject);
	});
}

async function fetchValidImages(transcript, length, ai, duration) {
	if (ai && duration === 1) {
		const promises = [];

		for (let i = 0; i < length; i++) {
			// var myHeaders = new Headers();
			// myHeaders.append("Content-Type", "application/json");
			// console.log(transcript[i].asset)

			// // var raw = JSON.stringify({
			// // 	//   "key": "",
			// // 	"prompt": `${transcript[i].asset} realistic and clean looking`,
			// // 	//   "negative_prompt": null,
			// // 	"width": "720",
			// // 	"height": "720",
			// // 	"samples": "3",
			// // 	"num_inference_steps": "2",
			// // 	//   "seed": null,
			// // 	//   "guidance_scale": 7.5,
			// // 	"safety_checker": "no",
			// // 	//   "multi_lingual": "no",
			// // 	//   "panorama": "no",
			// // 	//   "self_attention": "no",
			// // 	//   "upscale": "no",
			// // 	//   "embeddings_model": null,
			// // 	//   "webhook": null,
			// // 	//   "track_id": null
			// // });
			// var requestOptions = {
			// 	headers: myHeaders,
			// };

			// const result = fetch(`http://localhost:8000?prompt=${encodeURI(transcript[i].asset + " minimalist ")}`, requestOptions)
			// 	.then(response => response.json())
			// 	.catch(error => console.log('error', error));
			// promises.push(result);

			promises.push(new Promise((res, rej) => {
				exec(`PROMPT='${transcript[i].asset.replace(/'/gi,"").replace(/"/gi, "") + " minimalist wide shot"}' /home/leapfrog/projects/personal/stable-diffusion-webui/venv/bin/python /home/leapfrog/projects/personal/ComfyUI/ComfyUI-to-Python-Extension/workflow_api_sd3_image.py`, async (err, stdout, stderr) => {
					if (err) {
						console.error(`exec error: ${err}`)
						return
					}
					if (stderr) { console.log(`stderr: ${stderr}`); }
					stdout && console.log(`stdout: ${stdout}`)

					const val = `${stdout}`.split('\n').at(-2)
					const parsedVal = JSON.parse(val)
					console.log(parsedVal)

					exec(`IMG_PATH='/home/leapfrog/projects/personal/ComfyUI/output/${parsedVal["paths"][0]}' /home/leapfrog/projects/personal/stable-diffusion-webui/venv/bin/python /home/leapfrog/projects/personal/ComfyUI/ComfyUI-to-Python-Extension/workflow_api.py`, async (err, stdout, stderr) => {
						if (err) {
							console.error(`exec error: ${err}`)
							return
						}

						if (stderr) { console.log(`stderr: ${stderr}`); }
						if (stdout) {
							console.log(`stdout: ${stdout}`);
							const val = `${stdout}`.split('\n').at(-2)

							res(JSON.parse(val))
						}
					})
				})
			}))
		}

		const aiImages = await Promise.all(promises);

		return aiImages;
	} else {
		const images = [];
		for (let i = 0; i < length; i++) {
			const imageFetch = await fetch(
				`https://www.googleapis.com/customsearch/v1?q=${encodeURI(
					transcript[i].asset
				)}&cx=${process.env.GOOGLE_CX}&searchType=image&key=${process.env.GOOGLE_API_KEY
				}&num=${4}`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				}
			);
			const imageResponse = await imageFetch.json();

			// Check if the response contains 'items' and they are iterable
			if (
				!Array.isArray(imageResponse.items) ||
				imageResponse.items.length === 0
			) {
				console.log(
					'No images found or items not iterable',
					imageResponse.items
				);
				images.push({ link: 'https://images.smart.wtf/black.png' });
				continue; // Skip to the next iteration
			}

			const validMimeTypes = ['image/png', 'image/jpeg'];
			let imageAdded = false;

			for (let image of imageResponse.items) {
				if (validMimeTypes.includes(image.mime)) {
					const isViewable = await checkImageHeaders(image.link);
					if (isViewable) {
						images.push(image);
						imageAdded = true;
						break; // Stop after adding one valid image
					}
				}
			}

			// If no valid images were added, push a default image
			if (!imageAdded) {
				images.push({ link: 'https://images.smart.wtf/black.png' });
			}
		}

		return images;
	}
}

async function checkImageHeaders(url) {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		const contentType = response.headers.get('Content-Type');
		const contentDisposition = response.headers.get('Content-Disposition');

		// Check for direct image content types and absence of attachment disposition
		if (
			contentType.includes('image/png') ||
			contentType.includes('image/jpeg')
		) {
			if (!contentDisposition || !contentDisposition.includes('attachment')) {
				return true; // Image is likely viewable directly in the browser
			}
		}
	} catch (error) {
		console.error('Error checking image headers:', error);
	}
	return false;
}

const imagePrompt = async (title) => {
	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'user',
					content: title,
				},
			],
		});

		return response.choices[0]?.message.content;
	} catch (error) {
		console.error('Error fetching data:', error);
	}
};

const imageGeneneration = async (initialPrompt) => {
	const prompt = await imagePrompt(initialPrompt);
	const detailed8BitPreface =
		'Create an image in a detailed retro 8-bit style. The artwork should have a pixelated texture and should have vibrant coloring and scenery.';

	let fullPrompt = `${detailed8BitPreface} ${prompt} Remember, this is in retro 8-bit style`;
	fullPrompt = fullPrompt.substring(0, 900);

	const responseFetch = await openai.images.generate({
		model: 'dall-e-3',
		prompt: fullPrompt,
		n: 1,
		size: '1024x1024',
		quality: 'standard',
		style: 'vivid',
		response_format: 'url',
		user: 'user-1234',
	});

	return {
		imageUrl: responseFetch.data[0]?.url,
		initialPrompt: initialPrompt,
		prompt: prompt,
	};
};
