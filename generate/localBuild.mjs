import transcribeFunction from './transcribe.mjs';
import path from 'path';
import { exec } from 'child_process';
import { topics } from './topics.mjs';
import { rm, mkdir, unlink } from 'fs/promises';

export const PROCESS_ID = 0;

function getRandomElement(elements) {
	const selectedIndex = Math.floor(Math.random() * elements.length);
	return elements[selectedIndex]
}

async function cleanupResources() {
	try {
		await rm(path.join('public', 'srt'), { recursive: true, force: true });
		await rm(path.join('public', 'voice'), { recursive: true, force: true });
		await unlink(path.join('public', `audio-${PROCESS_ID}.mp3`)).catch((e) =>
			console.error(e)
		);
		await unlink(path.join('src', 'tmp', 'context.tsx')).catch((e) =>
			console.error(e)
		);
		await mkdir(path.join('public', 'srt'), { recursive: true });
		await mkdir(path.join('public', 'voice'), { recursive: true });
	} catch (err) {
		console.error(`Error during cleanup: ${err}`);
	}
}

const agents = [
	'KANYE_WEST',
	'BEN_SHAPIRO',
	'JORDAN_PETERSON',
	'JOE_ROGAN',
	'ALEX_JONES',
	'BEN_AFFLECK',
	'DRAKE',
	'ELON_MUSK',
	'JUSTIN_BIEBER',
	'LEX_FRIDMAN',
	'ROBERT_DOWNEY_JR',
	'BILL_GATES',
	'ARTIFICIAL_GENERAL_INTELLIGENCE aka A.G.I',
	'DONALD_TRUMP',
	'MARK_ZUCKERBERG',
	'JOE_BIDEN',
	'LIL_WAYNE',
	'ANDREW_TATE',
];

const local = true;

async function main() {
	const randomTopic = topics[Math.floor(Math.random() * topics.length)];

	// CHANGE THIS VALUE FOR YOUR CHOICE OF AGENTS
	const agentA = getRandomElement(agents);
	const agentB = getRandomElement(agents.filter(agent => agent !== agentA));

	// CHANGE THIS VALUE FOR A CUSTOM VIDEO TOPIC
	// const videoTopic = 'Proximal Policy Optimization';
	const aiGeneratedImages = true;
	const fps = 60;
	const duration = 1; //minute
	//MINECRAFT or TRUCK or GTA
	const background = Math.random() < 0.5 ? 'GTA' : "MINECRAFT";
	const music = getRandomElement(['WII_SHOP_CHANNEL_TRAP', 'FLUFFING_A_DUCK', 'MONKEYS_SPINNING_MONKEYS']);
	const cleanSrt = false;

	await transcribeFunction(
		local,
		randomTopic,
		agentA,
		agentB,
		aiGeneratedImages,
		fps,
		duration,
		background,
		music,
		cleanSrt
	);

	// run in the command line `npm run build`
	exec('npm run build', async (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return;
		}
		console.log(`stdout: ${stdout}`);
		console.error(`stderr: ${stderr}`);

		cleanupResources();
	});
}

(async () => {
	await main();
})();
