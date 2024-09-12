import { execSync, spawn } from 'child_process';
import fetch from 'node-fetch';
import fs, { writeFileSync } from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import getTranscriptAndTitle from './transcript.mjs';
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

export async function generateVideoContents(
	topic,
	agentA,
	agentB,
	fps,
	music,
) {
	const { transcript, videoTitle } = await getTranscriptAndTitle(topic, agentA, agentB);
	console.log(transcript, typeof transcript)
	const videoContents = [];

	const images = await generateImagesFromTranscript(transcript);

	for (const { person, line, code } of transcript) {
		const voice_id = VOICE_ID_MAP[person]

		await generateAudioAndSrt(voice_id, person, line, i);
		console.log(i + 1, images?.["paths"][i])
		videoContents.push({
			person: person,
			audio: `public/voice/${person}-${i}.mp3`,
			index: i,
			code,
			images: images?.["paths"][i] || 'https://images.smart.wtf/black.png'
			// && `data:image/jpeg;charset=utf-8;base64, ${images?.[i]?.images}`
		});
	}

	const initialAgentName = videoContents[0].person;

	const contextContent = `
import { staticFile } from 'remotion';

export const music: string = ${music === 'NONE' ? `'NONE'` : `'/music/${music}.MP3'`
		};
export const fps = ${fps};
export const initialAgentName = '${initialAgentName}';
export const subtitlesFileName = [
  ${videoContents
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

	return { audios: videoContents, transcript, videoTitle };
}

export async function generateAudioAndSrt(voice_id, person, line, index) {
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
		const subProcess = spawn(command, args);

		let output = '';

		subProcess.stdin.write(input);
		subProcess.stdin.end()
		process.stdout.pipe(process.stdout);
		subProcess.stdout.on('data', (data) => {
			output += data.toString();
		});

		subProcess.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});



		subProcess.on('close', (code) => {
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

async function generateImagesFromTranscript(transcript) {
	// Function to process the asset description
	const processDescription = (description) => {
		// Remove unwanted characters from the description
		let assetDescription = (description || "").replace(/'/gi, "").replace(/"/gi, "").replace(/,/gi, "");

		// List of keywords related to hands and their root forms
		const handRelatedKeywords = [
			"hand",
			"thumb",
			"point",
			"cook",
			"hold",
			"grab",
			"finger",
			"gesture",
			"pointing",
			"cooking",
			"holding",
			"grabbing",
			"fingers",
			"gesturing"
		]

		// Remove any keywords related to hands from the description
		Object.keys(handRelatedKeywords).forEach(keyword => {
			const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
			assetDescription = assetDescription.replace(regex, "");
		});

		// Add the specified style to the prompt
		return `${assetDescription} wide shot in the style of Alice in Wonderland movie Johnny Depp art style`;
	};

	const aiImages = await new Promise(async (res) => {
		console.log(transcript, typeof transcript)
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
	});

	return aiImages;
}

const imageGenenerationWithDallE = async (initialPrompt) => {
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
