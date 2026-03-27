import { ScaleMuleChat } from './factory';
import { ChatClient } from './core/ChatClient';
import './element';

export const create = ScaleMuleChat.create.bind(ScaleMuleChat);
export const version = ScaleMuleChat.version;
export { ChatClient };
