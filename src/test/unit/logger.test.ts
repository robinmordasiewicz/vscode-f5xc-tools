// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import { Logger, getLogger } from '../../utils/logger';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn().mockReturnValue('info'),
    })),
  },
}));

describe('Logger', () => {
  let logger: Logger;
  let mockOutputChannel: { appendLine: jest.Mock; show: jest.Mock; dispose: jest.Mock };

  beforeEach(() => {
    mockOutputChannel = {
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    };
    (vscode.window.createOutputChannel as jest.Mock).mockReturnValue(mockOutputChannel);
    logger = new Logger('Test Logger');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create output channel with name', () => {
      expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Test Logger');
    });
  });

  describe('debug', () => {
    it('should not log when log level is info', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('info'),
      });

      logger.debug('Debug message');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should log when log level is debug', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('debug'),
      });

      logger.debug('Debug message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should log arguments when provided', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('debug'),
      });

      logger.debug('Debug message', { key: 'value' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2);
    });
  });

  describe('info', () => {
    it('should log when log level is info', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('info'),
      });

      logger.info('Info message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should not log when log level is warn', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('warn'),
      });

      logger.info('Info message');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should log arguments when provided', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('info'),
      });

      logger.info('Info message', { data: 'test' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2);
    });
  });

  describe('warn', () => {
    it('should log when log level is warn', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('warn'),
      });

      logger.warn('Warning message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should log when log level is info', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('info'),
      });

      logger.warn('Warning message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should not log when log level is error', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('error'),
      });

      logger.warn('Warning message');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('error'),
      });

      logger.error('Error message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should always log errors regardless of level', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('error'),
      });

      logger.error('Error message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('error'),
      });

      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(`Error: ${error.message}`);
    });

    it('should log error stack when available', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('error'),
      });

      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      logger.error('Error occurred', error);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Error stack trace');
    });

    it('should log additional arguments', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('error'),
      });

      logger.error('Error message', undefined, { context: 'test' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2);
    });
  });

  describe('show', () => {
    it('should call show on output channel', () => {
      logger.show();
      expect(mockOutputChannel.show).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should call dispose on output channel', () => {
      logger.dispose();
      expect(mockOutputChannel.dispose).toHaveBeenCalled();
    });
  });
});

describe('getLogger', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should return a logger instance', () => {
    const logger = getLogger();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should return the same instance on subsequent calls', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();
    expect(logger1).toBe(logger2);
  });
});
