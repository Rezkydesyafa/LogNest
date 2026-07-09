import { LOG_LEVELS, LOG_SOURCE_TYPES, SERVER_LOG_SOURCE_TYPES } from './constants';

export type LogSourceType = (typeof LOG_SOURCE_TYPES)[number];
export type ServerLogSourceType = (typeof SERVER_LOG_SOURCE_TYPES)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];
