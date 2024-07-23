import { Composition, staticFile } from 'remotion';
import { AudioGramSchema, AudiogramComposition } from './Composition';
import './style.css';
import {
	initialAgentName,
	subtitlesFileName,
	fps,
} from './tmp/context';
import { getAudioDurationInSeconds } from '@remotion/media-utils';

const PROCESS_ID = 0;

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="Video"
				component={AudiogramComposition}
				fps={fps}
				width={1080}
				height={1920}
				schema={AudioGramSchema}
				defaultProps={{
					// Audio settings
					audioOffsetInSeconds: 0,
					// Title settings
					audioFileName: staticFile(`audio-${PROCESS_ID}.mp3`),
					titleText: 'Back propagation',
					titleColor: 'rgba(186, 186, 186, 0.93)',

					initialAgentName,

					// Subtitles settings
					subtitlesFileName,
					agentDetails: {
						JOE_ROGAN: {
							color: '#bc462b',
							image: 'JOE_ROGAN.png',
						},
						JORDAN_PETERSON: {
							color: '#ffffff',
							image: 'JORDAN_PETERSON.png',
						},
						BEN_SHAPIRO: {
							color: '#90EE90',
							image: 'BEN_SHAPIRO.png',
						},
						KANYE_WEST: {
							color: '#A020F0',
							image: 'BARACK_OBAMA.png',
						},
						ANDREW_TATE: {
							color: '#b6def1',
							image: 'RICK_SANCHEZ.png',
						},
						DONALD_TRUMP: {
							color: '#b32134',
							image: 'DONALD_TRUMP.png',
						},
						LIL_WAYNE: {
							color: '#ff0000',
							image: 'LIL_YACHTY.png',
						},
						JOE_BIDEN: {
							color: '#0000ff',
							image: 'JOE_BIDEN.png',
						},
						MARK_ZUCKERBERG: {
							color: '#0668E1',
							image: 'MARK_ZUCKERBERG.png',
						},
					},
					subtitlesTextColor: 'rgba(255, 255, 255, 0.93)',
					subtitlesLinePerPage: 6,
					subtitlesZoomMeasurerSize: 10,
					subtitlesLineHeight: 128,

					// Wave settings
					waveFreqRangeStartIndex: 7,
					waveLinesToDisplay: 30,
					waveNumberOfSamples: '256', // This is string for Remotion controls and will be converted to a number
					mirrorWave: true,
					durationInSeconds: 60,
				}}
				// Determine the length of the video based on the duration of the audio file
				calculateMetadata={async ({ props }) => {
					const duration =
						(await getAudioDurationInSeconds(staticFile(`audio-${PROCESS_ID}.mp3`))) + 3;
					return {
						durationInFrames: Math.ceil(duration * fps),
						props,
					};
				}}
			/>
		</>
	);
};
