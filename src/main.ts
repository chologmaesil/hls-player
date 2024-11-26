//import { HLSPlayer } from './core/HLSPlayer';
import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video') as HTMLVideoElement;
  const streamUrl = document.getElementById('streamUrl') as HTMLInputElement;
  const loadButton = document.getElementById('loadStream') as HTMLButtonElement;

  let player: HLSPlayer | null = null;

  loadButton.addEventListener('click', async () => {
    try {
      // 기존 player 정리
      if (player) {
        player.destroy();
      }

      // 새 player 인스턴스 생성
      player = new HLSPlayer({
        url: streamUrl.value,
        video: video,
      });

      await player.load();
      console.log('Stream loaded successfully');
    } catch (error) {
      console.error('Failed to load stream:', error);
    }
  });
});
