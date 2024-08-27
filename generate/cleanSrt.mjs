import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
import { VGEN_CLEAN_SRT_GENERATOR_MODEL_NAME } from './env.mjs';

dotenv.config();

export async function generateCleanSrt(transcript, srt) {
	const promises = [];
	for (let i = 0; i < transcript.length; i++) {
		promises.push(cleanSrt(transcript[i].line, srt[i].content, i));
	}
	const responses = await Promise.all(promises);

	for (let i = 0; i < srt.length; i++) {
		const response = responses.find((response) => response.i === i);
		if (response) {
			await writeFile(srt[i].fileName, response.content, 'utf8');
		}
	}
}


function parseContent(element) {
	return element['message']['content']
}

function parseResponse(element) {
	return element['response']
}


async function extractResponseText(response) {
	// Making a valid JSON array of objects from model output
	const text = await response.text()
	const textArr = text.split("\n")

	const rawText = '[' + textArr.slice(0, textArr.length - 1).join(",") + ']'

	const parser = !`${response.url}`.includes("generate") ? parseContent : parseResponse

	let jsonValue = ''
	try {
		jsonValue = JSON.parse(rawText);
	}
	catch (e) {
		console.log(rawText, e)
		throw e;
	}

	return jsonValue.map(parser).join("")

}
async function cleanSrt(transcript, srt, i) {
	const completion = await fetch('http://localhost:11434/api/chat', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: JSON.stringify({
			messages: [
				{
					role: 'system',
					content: `The first item I will give you is the correct text, and the next will be the SRT generated from this text which is not totally accurate. Sometimes the srt files just doesn't have words so if this is the case add the missing words to the SRT file which are present in the transcript. Based on the accurate transcript, and the possibly inaccurate SRT file, return the SRT text corrected for inaccurate spelling and such. Make sure you keep the format and the times the same. YOU MUST RETAIN THE FORMAT!
	
transcript: 
${transcript}

srt file text: 
${srt}`,
				},
				{
					role:'user',
					content: "follow the system prompt accurately!"
				}
			],
			model: VGEN_CLEAN_SRT_GENERATOR_MODEL_NAME || 'llama3:8b-instruct-q8_0',
		})
	});


	const content = await extractResponseText(completion);
	;
	return { content, i };
}
