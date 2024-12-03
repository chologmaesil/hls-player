import { describe, test, expect } from 'vitest';
import { parseMasterManifest, parseMediaManifest } from '../core/parser';
import { ParserTestData } from './parser.fixtures';
import { ContainerFormat } from '../types/types';

describe('HLS Manifest Parser', () => {
  const baseUrl = 'http://example.com/';

  describe('Master Manifest Parsing', () => {
    test('should correctly parse master manifest with multiple variants', () => {
      const result = parseMasterManifest(ParserTestData.MasterManifest.Basic, baseUrl);

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toEqual({
        bandwidth: 1280000,
        resolution: '1280x720',
        codecs: 'avc1.4d401f,mp4a.40.2',
        url: 'http://example.com/video_720p.m3u8',
      });
    });

    test('should correctly parse master manifest with single variant', () => {
      const result = parseMasterManifest(ParserTestData.MasterManifest.SingleVariant, baseUrl);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].bandwidth).toBe(1280000);
    });
  });

  describe('Media Manifest Parsing', () => {
    test('should correctly parse VOD TS manifest', () => {
      const result = parseMediaManifest(ParserTestData.MediaManifest.VodTs, baseUrl);

      expect(result).toEqual({
        version: 3,
        playlistType: 'VOD',
        targetDuration: 10,
        mediaSequence: 0,
        endList: true,
        containerFormat: ContainerFormat.MPEG_TS,
        segments: [
          {
            duration: 9.009,
            uri: 'http://example.com/segment1.ts',
            sequence: 0,
          },
          {
            duration: 8.008,
            uri: 'http://example.com/segment2.ts',
            sequence: 1,
          },
        ],
      });
    });

    test('should correctly parse VOD fMP4 manifest with initialization segment', () => {
      const result = parseMediaManifest(ParserTestData.MediaManifest.VodFmp4, baseUrl);

      expect(result.containerFormat).toBe(ContainerFormat.FRAGMENTED_MP4);
      expect(result.initializationSegment).toEqual({
        uri: 'http://example.com/init.mp4',
      });
    });

    test('should correctly parse live manifest', () => {
      const result = parseMediaManifest(ParserTestData.MediaManifest.Live, baseUrl);

      expect(result.playlistType).toBeUndefined();
      expect(result.mediaSequence).toBe(123);
      expect(result.endList).toBe(false);
      expect(result.segments[0].sequence).toBe(123);
    });
  });
});
