export type SeekCallback = (ratio: number) => void;

export interface WaveformApi {
  setProgress(ratio: number): void;
  setBars(bars: number[] | null): void;
  setDecoding(val: boolean): void;
  onSeek(cb: SeekCallback): void;
  setTimeLabels(currentSeconds: number, totalSeconds: number): void;
  destroy(): void;
}
