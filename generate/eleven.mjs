import { execSync, spawn } from 'child_process';
import fetch from 'node-fetch';
import fs, { writeFileSync } from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import transcriptFunction from './transcript.mjs';
import { writeFile } from 'fs/promises';
import { query } from './dbClient.mjs';

dotenv.config();

import OpenAI from 'openai';
import { VGEN_AUDIO_GENERATOR_MODEL_NAME, VGEN_IMAGE_GENERATOR_MODEL_NAME, VGEN_TRANSCRIPT_GENERATOR_MODEL_NAME } from './env.mjs';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export const VOICE_ID_MAP = {
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
	'SAM_ALTMAN': 'sam-altman',
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
	music,
	videoId
) {
	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Generating transcript', progress = 0 WHERE video_id = ?",
			[videoId]
		);
	}

	let { transcript, videoTitle } = await transcriptFunction(topic, agentA, agentB, duration);
	transcript = JSON.parse(transcript).transcript
	console.log(transcript, typeof transcript)
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
		console.log(images?.["paths"][i], "IMAGES.paths[i]")
		audios.push({
			person: person,
			audio: `public/voice/${person}-${i}.mp3`,
			index: i,
			code,
			images:
				ai && duration === 1
					? images?.["paths"][i] || 'https://images.smart.wtf/black.png'
					// && `data:image/jpeg;charset=utf-8;base64, ${images?.[i]?.images}`
					: images || 'https://images.smart.wtf/black.png',
		});
	}

	const initialAgentName = audios[0].person;

	const contextContent = `
import { staticFile } from 'remotion';

export const music: string = ${music === 'NONE' ? `'NONE'` : `'/music/${music}.MP3'`
		};
export const fps = ${fps};
export const initialAgentName = '${initialAgentName}';
export const subtitlesFileName = [
  ${audios
			.map(
				(entry, i) => `{
    name: '${entry.person}',
    file: staticFile('srt/${entry.person}-${i}.srt'),
    asset: '${entry.images}',
	code: \`${entry?.code?.replaceAll("\`", "\\\`").replaceAll("$", "\\$").replaceAll(";", ";\n") || ''}\`,
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
				model: VGEN_AUDIO_GENERATOR_MODEL_NAME || 'ar-diff-50k',
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

const runProcessAndParseJSON = (command, args, input) => {

	return new Promise((res) => {

		const process = spawn(command, args);

		let output = '';

		process.stdin.write(input);
		process.stdin.end()

		process.stdout.on('data', (data) => {
			output += data.toString();
			console.log('stdout', data.toString())
		});

		process.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});



		process.on('close', (code) => {
			console.log(`child process exited with code ${code}`);
			const lines = output.trim().split('\n');
			for (let i = lines.length - 1; i >= 0; i--) {
				const line = lines[i];
				if (line) {
					try {
						res(JSON.parse(line));
						break;
					} catch (e) {
						res(line)
						console.error("Error parsing JSON:", e);
						throw new Error('Oopsie... ' + e);
					}
				}
			}
		})
	})
};

async function fetchValidImages(transcript, length, ai, duration) {
	// Function to process the asset description
	const processDescription = (description) => {
		// Remove unwanted characters from the description
		let assetDescription = (description || "").replace(/'/gi, "").replace(/"/gi, "").replace(/,/gi, "");

		// List of keywords related to hands and their root forms
		const handKeywords = {
			"hand": "hand",
			"thumb": "thumb",
			"pointing": "point",
			"cooking": "cook",
			"holding": "hold",
			"grabbing": "grab",
			"fingers": "finger",
			"gesturing": "gesture"
		};

		// Remove any keywords related to hands from the description
		Object.keys(handKeywords).forEach(keyword => {
			const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
			assetDescription = assetDescription.replace(regex, handKeywords[keyword]);
		});

		// Add the specified style to the prompt
		return `${assetDescription} wide shot in the style of Alice in Wonderland movie Johnny Depp art style`;
	};

	// Check if AI processing is enabled and duration is 1
	if (ai && duration === 1) {
		const promises = [];
		// Create a new promise for AI image processing
		promises.push(new Promise(async (res, rej) => {
			// Run the Python script to generate images
			const images = await runProcessAndParseJSON('python', ['workflow_api_sd3_image.py'], transcript.map(dialogue => processDescription(dialogue.asset)).join(","));

			console.log({ images }, typeof images);
			// Run the Python script to generate videos from images
			const vids = images || await runProcessAndParseJSON('python', ['workflow_api_svd_video.py'], images["paths"].map(path => `/Users/safalpandey/projects/personal/ComfyUI/output/${path}`).join(","));
			const mp4s = { "paths": [] };
			console.log(vids);
			const parsedVids = vids["paths"];
			console.log(parsedVids);
			// Convert each video to MP4 format
			// for (let vid of parsedVids) {
			//     const newVid = `${vid.split(".")[0]}.mp4`;
			//     console.log(vid);
			//     await new Promise(res => exec(`magick /Users/safalpandey/projects/personal/ComfyUI/output/${vid} /Users/safalpandey/projects/personal/ComfyUI/output/${newVid}`, (err, stdout, stderr) => {
			//         if (err) {
			//             console.error("err", err);
			//         }
			//         stderr && console.log(stderr);
			//         stdout && console.log("stdout", stdout);
			//         mp4s["paths"] = [...mp4s["paths"], newVid];
			// res();
			//     }));
			// }
			console.log("asd", mp4s);
			// Resolve the promise with the MP4 paths
			res(mp4s);
		}));
		// Wait for all promises to resolve
		const [aiImages] = await Promise.all(promises);
		return aiImages;
	} else {
		const images = [];
		// Loop through each transcript item
		for (let i = 0; i < length; i++) {
			// Process the asset description
			const searchQuery = processDescription(transcript[i].asset);

			// Fetch images from Google Custom Search API
			const imageFetch = await fetch(
				`https://www.googleapis.com/customsearch/v1?q=${encodeURI(
					searchQuery
				)}&cx=${process.env.GOOGLE_CX}&searchType=image&key=${process.env.GOOGLE_API_KEY
				}&num=${4}`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				}
			);
			const imageResponse = await imageFetch.json();
			// Check if the response contains valid items
			if (
				!Array.isArray(imageResponse.items) ||
				imageResponse.items.length === 0
			) {
				console.log(
					'No images found or items not iterable',
					imageResponse.items
				);
				// Add a placeholder image if no valid images are found
				images.push({ link: 'https://images.smart.wtf/black.png' });
				continue;
			}
			const validMimeTypes = ['image/png', 'image/jpeg'];
			let imageAdded = false;
			// Loop through each image item
			for (let image of imageResponse.items) {
				// Check if the image has a valid MIME type
				if (validMimeTypes.includes(image.mime)) {
					// Check if the image is viewable
					const isViewable = await checkImageHeaders(image.link);
					if (isViewable) {
						// Add the image to the list
						images.push(image);
						imageAdded = true;
						break;
					}
				}
			}
			// Add a placeholder image if no valid images are added
			if (!imageAdded) {
				images.push({ link: 'https://images.smart.wtf/black.png' });
			}
		}
		// Return the list of images
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
			model: VGEN_TRANSCRIPT_GENERATOR_MODEL_NAME || 'gpt-3.5-turbo',
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
		model: VGEN_IMAGE_GENERATOR_MODEL_NAME || 'dall-e-3',
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
