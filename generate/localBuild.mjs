import generateVideoContext from './transcribe.mjs';
import path from 'path';
import { spawn } from 'child_process';
import { topics } from './topics.mjs';
import { rm, mkdir, unlink, readdir } from 'fs/promises';
import { VOICE_ID_MAP } from './eleven.mjs'
export const PROCESS_ID = 0;

function getRandomElement(elements) {
	const selectedIndex = Math.floor(Math.random() * elements.length);
	return elements[selectedIndex]
}

async function cleanupResources() {
	try {
		await rm(path.join('public', 'srt'), { recursive: true, force: true });
		await rm(path.join('public', 'voice'), { recursive: true, force: true });
		await unlink(path.join('public', `audio-${PROCESS_ID}.mp3`)).catch((e) => { });
		await unlink(path.join('src', 'tmp', 'context.tsx')).catch((e) => { });
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
	// 'ALEX_JONES',
	'BEN_AFFLECK',
	'DRAKE',
	'ELON_MUSK',
	'JUSTIN_BIEBER',
	'LEX_FRIDMAN',
	'ROBERT_DOWNEY_JR',
	'BILL_GATES',
	'SAM_ALTMAN',
	'DONALD_TRUMP',
	'MARK_ZUCKERBERG',
	'JOE_BIDEN',
	// 'LIL_WAYNE',
	'ANDREW_TATE',
	'BEYONCE'
];

function validateAgentToVoiceIdMap() {
	if (!agents.every(a => VOICE_ID_MAP[a])) {
		throw new Error(`Some agents have missing voice Id in ./eleven.mjs. Please add proper voice id for newly added agents. Missing voice_id for: ${agents.filter(a => !VOICE_ID_MAP[a])}`)
	}
}

const local = true;


const runProcess = (command, args, input, pipe = false) => {
	return new Promise(() => {

		const childProcess = spawn(command, args);

		let output = '';

		childProcess.stdin.write(input);
		childProcess.stdin.end();

		if (pipe) {
			childProcess.stdout.pipe(process.stdout)
		}
		childProcess.stderr.pipe(process.stderr)

		childProcess.on('close', (code) => {
			console.log(`child process exited with code ${code}`);
		})
	})
};

async function main() {
	validateAgentToVoiceIdMap();

	await cleanupResources()
	// const randomTopic = topics[Math.floor(Math.random() * topics.length)];
	const promptedTopic = process.argv.slice(2).join(" ");

	// CHANGE THIS VALUE FOR YOUR CHOICE OF AGENTS which must be present in the agents array
	const agentA = getRandomElement(agents);
	const agentB = getRandomElement(agents.filter(agent => agent !== agentA));

	const fps = 60;
	const duration = 1; //minute
	//MINECRAFT or TRUCK or GTA
	const files = await readdir('./public/music')
	const music = getRandomElement(files.map(file => file.split(".")[0]));
	const cleanSrt = false;

	const videoTitle = await generateVideoContext(
		local,
		promptedTopic,
		agentA,
		agentB,
		fps,
		music,
	);

	const filename = `${videoTitle.replaceAll(/['\"]/g, "").replaceAll(" ", "_")}.mp4`

	// run in the command line `npm run build`
	await runProcess(`npm`, [`run`, 'build', `out/${filename}`], "", true)
	await cleanupResources();

	return filename;
}

(async () => {
	await main();
	console.log("VIDEO PRODUCED:", filename);
})();
