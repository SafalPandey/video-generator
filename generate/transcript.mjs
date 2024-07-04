import dotenv from 'dotenv';
dotenv.config();
import Groq from 'groq-sdk/index.mjs';

const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});

async function generateTitle(transcript) {
	const completion = await groq.chat.completions.create({
		messages: [
			{
				role: 'system',
				content: `Create the most catchy title that is sure to go viral based on the transcript!!! Only respond with the best title only one title without any extra info. no quotes single or double`,
			},
			{
				role: 'user',
				// content: `generate a video about any specific javascript concept/pattern/inbuilt function that is highly useful and mostly unknown and try not to use repetitive topics like reduce and proxy and debounce and symbol. Both the agents should talk about it in a way they would normally, but extremify their qualities and make the conversation risque if either agents are controversial. Also the conversation should be resolved at the end. Make the second person teach the first person about any inbuilt useful function of javascript. Also, always end with a like and subscribe to learn more code message from both!`,
				content: `Follow system message! Here is the transcript: ${JSON.stringify(transcript)}`,
			},
		],
		model: 'llama3-70b-8192',
		temperature: 0.5,
		max_tokens: 4096,
		top_p: 1,
		stop: null,
		stream: false,
	});

	const content = completion.choices[0]?.message?.content || '';

	return content;
}

async function generateTranscript(topic, agentA, agentB, duration) {
	const completion = await groq.chat.completions.create({
		messages: [
			// {
			// 	role: 'system',
			// 	content: `Create a dialogue for a short-form conversation on any controversial topic (anything except climate change). The conversation should be between two agents, ${agentA.replace(
			// 		'_',
			// 		' '
			// 	)} and ${agentB.replace("_", " ")}, each with their unique mannerisms and speech patterns. ${agentA.replace(
			// 		'_',
			// 		' '
			// 	)} should engage with the topic with a sense of curiosity and a desire for practical understanding, while ${agentB.replace(
			// 		'_',
			// 		' '
			// 	)} offers a deep, analytical perspective. The dialogue should be engaging and include light humor, yet still provide meaningful insights into the topic. Limit the dialogue to a MAXIMUM OF ${4
			// 		} EXCHANGES, aiming for a concise transcript that would last less than 1 minute. The person attribute should either be ${agentA} or ${agentB}. The line attribute should be that character's line of dialogue. I also need an asset description under the asset attribute which would be a relevant search query to find an image which should be relevant to the overall topic of the conversation. The asset descriptions shouldn't be vague, but a description of something that you think would be a good image to go along with the conversation. Specificity is key. The JSON format WHICH MUST BE ADHERED TO ALWAYS is as follows: { transcript: { [ {'person': 'the exact value of ${agentA} or ${agentB} depending on who is talking', 'line': 'their line of conversation in the dialog', asset: 'relevant image generate query based on the current line'} ] } }`,
			// },
			// {
			// 	role: 'user',
			// 	content: `generate a video about any specific controversial topic. Both the agents should talk about it in a way they would, but extremify their qualities and make the conversation risque if either agents are controversial. Try to make the conversation as controversial as possible. Also the conversation should be resolved at the end. Make them use vulgar words as each other.`,
			// },
			
			// ===============
			// WORKING PROMPTS
			// ===============
			{
				role: 'system',
				content: `Create a dialogue for a short-form conversation. The conversation should be between two agents, ${agentA.replace(
					'_',
					' '
				)} and ${agentB.replace("_", " ")}, each with their unique mannerisms and speech patterns. ${agentA.replace(
					'_',
					' '
				)} should engage with the topic with a sense of curiosity and a desire for practical understanding, while ${agentB.replace(
					'_',
					' '
				)} offers a deep, analytical perspective. The dialogue should be engaging and include light humor, yet still provide meaningful insights into the topic. Try aiming for a concise transcript that MUST only be LESS THAN 40 SECONDS. The person attribute should either be ${agentA} or ${agentB}. The line attribute should be that character's line of dialogue. I also need an asset description under the asset attribute which would be a relevant search query to find an image which should be relevant to the overall topic of the conversation. The asset descriptions shouldn't be vague, but a description of something that you think would be a good image to go along with the conversation. Specificity is key. The JSON format WHICH MUST BE ADHERED TO ALWAYS! IT MUST ONLY HAVE 5 ELEMENTS AT MOST INSIDE THE 'transcript' ARRAY. THE FORMAT is as follows: { transcript: { [ {'person': 'the exact value of ${agentA} or ${agentB} depending on who is talking', 'line': 'their line of conversation in the dialog. important to note that if they are mentioning any code specifics even like the words javascript or HTML or python make sure it is spelled properly in the line attribute! For example: write api as A-P-I to ensure they pronounce the letters correctly!', 'code': \`Well formatted valid relevant code content here. always include the output as comment in console log lines include newline characters. Make sure you add a lot of relavant code as much as possible with comments describing them! MAKE SURE THE MAX WIDTH OF THE CODE IS 46 CHARACTERS INCLUDING WHITESPACE CHARACTERS SO BREAK LINE OR WHATEVER BEFORE THE CHARACTERS OVERFLOW!!! NEVER USE BACKTICKS \"\`\" INSIDE THE CODE CONTENT!\`,'asset': 'relevant image generate query based on the current line. NEVER DRAW ANY SCREENSHOTS!!! NO LONG SMALL TEXTS! ONLY LARGE SHORT TEXTS ALLOWED IF NEEDED. NO LOGOS. NO TEXT. NO CHARTS GRAPHICS. TRY TO DESCRIBE A SCENE OR AN OBJECT!!! Always describe realistic images! try to keep the background attractive like a green scenary or a city scape background no texts involved!'} ] } }`,
			},
			{
				role: 'user',
				// content: `generate a video about any specific javascript concept/pattern/inbuilt function that is highly useful and mostly unknown and try not to use repetitive topics like reduce and proxy and debounce and symbol. Both the agents should talk about it in a way they would normally, but extremify their qualities and make the conversation risque if either agents are controversial. Also the conversation should be resolved at the end. Make the second person teach the first person about any inbuilt useful function of javascript. Also, always end with a like and subscribe to learn more code message from both!`,
				content: (topic || "generate a video about any specific Impact of A-I in the future of humanity. Current trends in tech companies building robots and more. Make sure they don't repeat the same dialogue.") + ". The agents should talk about it in a way they would normally, but extremify their qualities and make the conversation risque if either agents are controversial but try to focus on the topic as much as possible. Also the conversation should be resolved at the end. Also, always end with a like and subscribe to learn more code message from both! YOU MUST KEEP THE TOTAL VIDEO UNDER 45 SECONDS ONLY!!! FOLLOW EVERY INSTRUCTION IN THE SYSTEM MESSAGE EXACTLY!!!!!",
			},
			// {
			// 	role: 'system',
			// 	content: `Create a script for a 10 minutes tutorial video. The tutorial should be as easy to follow as possible, It is driven by two agents: ${agentA.replace(
			// 		'_',
			// 		' '
			// 	)} with ${agentB.replace("_", " ")} asking questions in the middle to explain the code the first agent has produced relating to the tutorial. Each agents with their unique mannerisms and speech patterns. ${agentB.replace(
			// 		'_',
			// 		' '
			// 	)} should engage with the topic with a sense of curiosity and a desire for practical understanding, while ${agentA.replace(
			// 		'_',
			// 		' '
			// 	)} offers a deep, analytical perspective. The dialogue should be engaging and include light humor, yet still provide meaningful insights into the topic. Try aiming for a concise transcript. The person attribute should either be ${agentA} or ${agentB}. The line attribute should be that character's line of dialogue. I also need an asset description under the asset attribute which would be a relevant search query to find an image which should be relevant to the overall topic of the conversation. The asset descriptions shouldn't be vague, but a description of something that you think would be a good image to go along with the conversation. Specificity is key. The JSON format WHICH MUST BE ADHERED TO ALWAYS is as follows: { transcript: { [ {'person': 'the exact value of ${agentA} or ${agentB} depending on who is talking', 'line': 'their line of conversation in the dialog. important to note that if they are mentioning any code specifics even like the word javascript make sure it is spelled properly in the line attribute! For example: write api as A-P-I to ensure they pronounce the letters correctly!', 'code': \`ONLY IF NEEDED FOR THE TOPIC OTHERWISE SET ITS VALUE AS AN EMPTY STRING! Well formatted valid relevant code content here. always include the output as comment in console.log lines include newline characters. Make sure you add a lot of relavant code as much as possible with comments describing them! MAKE SURE THE MAX WIDTH OF THE CODE IS 46 CHARACTERS INCLUDING WHITESPACE CHARACTERS SO BREAK LINE OR WHATEVER BEFORE THE CHARACTERS OVERFLOW!!! NEVER USE BACKTICKS \"\`\" INSIDE THE CODE CONTENT!\`,'asset': 'relevant image generate query based on the current line. NEVER DRAW ANY SCREENSHOTS!!! NO LONG SMALL TEXTS! ONLY LARGE SHORT TEXTS ALLOWED IF NEEDED. NO LOGOS. NO TEXT. NO CHARTS GRAPHICS. TRY TO DESCRIBE A SCENE OR AN OBJECT!!! Always describe realistic images! try to keep the background attractive like a green scenary or a city scape background no texts involved!'} ] } }`,
			// },
			// {
			// 	role: 'user',
			// 	// content: `generate a video about any specific javascript concept/pattern/inbuilt function that is highly useful and mostly unknown and try not to use repetitive topics like reduce and proxy and debounce and symbol. Both the agents should talk about it in a way they would normally, but extremify their qualities and make the conversation risque if either agents are controversial. Also the conversation should be resolved at the end. Make the second person teach the first person about any inbuilt useful function of javascript. Also, always end with a like and subscribe to learn more code message from both!`,
			// 	content: (topic || "generate a video about any specific Impact of A-I in the future of humanity. Current trends in tech companies building robots and more. Make sure they don't repeat the same dialogue.") + ". The agents should talk about it in a way they would normally, but extremify their qualities and make the conversation risque if either agents are controversial but try to focus on the topic as much as possible. Also the conversation should be resolved at the end. Also, always end with a like and subscribe to learn more code message from both! MAKE EACH DIALOGUE AS LONG AS IT MAKES SENSE TO INCREASE THE VIDEO LENGTH OR AT LEAST ADD MORE NEW DIALOGUES TO DO THE SAME. REMEMBER TO KEEP THE TOTAL VIDEO AROUND 10 MINUTES!!! FOLLOW EVERY INSTRUCTION IN THE SYSTEM MESSAGE EXACTLY!!!!!",
			// },
		],
		response_format: { type: 'json_object' },
		model: 'llama3-70b-8192',
		temperature: 0.5,
		max_tokens: 4096,
		top_p: 1,
		stop: null,
		stream: false,
	});

	const content = completion.choices[0]?.message?.content || '';

	return content;
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function transcriptFunction(
	topic,
	agentA,
	agentB,
	duration
) {
	let transcript = null;
	let attempts = 0;

	while (attempts < 5) {
		try {
			const content = await generateTranscript(topic, agentA, agentB, duration);
			transcript = content === '' ? null : JSON.parse(content);
			const videoTitle = await generateTitle(transcript)
			console.log(videoTitle)
			if (transcript !== null) {
				return { transcript, videoTitle };
			}
		} catch (error) {
			console.error('Attempt failed:', error);
			await delay(15000);
		}
		attempts++;
	}

	throw new Error(
		`Failed to generate valid transcript after 5 attempts for topic: ${topic}`
	);
}
