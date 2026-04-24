import { useState } from "react";
import type { ActivityMode, SocialConfig } from "../../../types";
import type PartySocket from "partysocket";

export function useRoomConfig(socket: PartySocket) {
  const [avatarStyle, setAvatarStyle]         = useState<string | null>(null);
  const [activity, setActivity]               = useState<ActivityMode>('canvas');
  const [soccerScore, setSoccerScore]         = useState({ left: 0, right: 0 });
  const [imageConfigOpen, setImageConfigOpen] = useState(false);
  const [roomImageUrl, setRoomImageUrl]       = useState('');
  const [socialConfigOpen, setSocialConfigOpen] = useState(false);
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [showNowLabelOnCanvas, setShowNowLabelOnCanvas] = useState(() =>
    localStorage.getItem('v4-showNowLabelOnCanvas') === 'true'
  );
  const [roomSocialConfig, setRoomSocialConfig] = useState<SocialConfig | null>(null);
  const [userCap, setUserCap]                 = useState<number | null>(null);
  const [capInput, setCapInput]               = useState<string>('');

  const sendAvatarStyle = (style: string | null) => {
    setAvatarStyle(style);
    socket.send(JSON.stringify({ type: 'setRoomAvatarStyle', avatarStyle: style }));
  };

  const sendActivity = (act: ActivityMode) => {
    setActivity(act);
    socket.send(JSON.stringify({ type: 'setActivity', activity: act }));
  };

  const sendImageUrl = (url: string) => {
    setRoomImageUrl(url);
    socket.send(JSON.stringify({ type: 'setImageUrl', url }));
  };

  const sendSocialConfig = (config: SocialConfig) => {
    setRoomSocialConfig(config);
    socket.send(JSON.stringify({ type: 'setSocialConfig', config }));
  };

  const resetSoccerScore = () => {
    socket.send(JSON.stringify({ type: 'resetSoccerScore' }));
  };

  const sendUserCap = (inputValue: string) => {
    const parsed = parseInt(inputValue, 10);
    const cap = inputValue === '' || parsed <= 0 ? null : parsed;
    socket.send(JSON.stringify({ type: 'setUserCap', cap }));
  };

  const applyConnected = (data: Record<string, unknown>) => {
    if ('roomAvatarStyle' in data) setAvatarStyle((data.roomAvatarStyle as string | null) ?? null);
    if ('currentActivity' in data) setActivity((data.currentActivity as ActivityMode) ?? 'canvas');
    if ('roomImageUrl' in data) setRoomImageUrl((data.roomImageUrl as string) ?? '');
    if ('roomSocialConfig' in data) setRoomSocialConfig((data.roomSocialConfig as SocialConfig | null) ?? null);
    if ('soccerScore' in data && data.soccerScore) setSoccerScore(data.soccerScore as { left: number; right: number });
    if (data.userCap !== undefined) {
      setUserCap(data.userCap as number | null);
      setCapInput(data.userCap !== null ? String(data.userCap) : '');
    }
  };

  const handleSocketEvent = (data: Record<string, unknown>) => {
    if (data.type === 'roomAvatarStyleChanged') {
      setAvatarStyle((data.avatarStyle as string | null) ?? null);
    } else if (data.type === 'activityChanged') {
      setActivity((data.activity as ActivityMode) ?? 'canvas');
    } else if (data.type === 'imageUrlChanged') {
      setRoomImageUrl((data.url as string) ?? '');
    } else if (data.type === 'socialConfigChanged') {
      setRoomSocialConfig((data.config as SocialConfig | null) ?? null);
    } else if (data.type === 'goalScored') {
      setSoccerScore(data.score as { left: number; right: number });
    } else if (data.type === 'userCapChanged') {
      setUserCap(data.cap as number | null);
      setCapInput(data.cap !== null ? String(data.cap) : '');
    }
  };

  return {
    avatarStyle, setAvatarStyle,
    activity, setActivity,
    soccerScore, setSoccerScore,
    imageConfigOpen, setImageConfigOpen,
    roomImageUrl, setRoomImageUrl,
    socialConfigOpen, setSocialConfigOpen,
    roomSocialConfig, setRoomSocialConfig,
    userCap, setUserCap,
    capInput, setCapInput,
    sendAvatarStyle,
    sendActivity,
    sendImageUrl,
    sendSocialConfig,
    resetSoccerScore,
    sendUserCap,
    applyConnected,
    handleSocketEvent,
    canvasSettingsOpen, setCanvasSettingsOpen,
    showNowLabelOnCanvas, setShowNowLabelOnCanvas,
  };
}
