import { post } from '@/utils/request';
import { ChatMessage } from 'chatgpt';

export interface MsgData {
  msg: string;
  ownerId: string;
  parentMessageId: string;
}

export const CHATGPT = {
  sendMsg: async (data: MsgData): Promise<Common.Response<ChatMessage>> => {
    const res = await post<ChatMessage, MsgData>('/q/sendMsg', data);
    console.log('chatgpt - /q/sendMsg:', res);
    return res;
  },
};
