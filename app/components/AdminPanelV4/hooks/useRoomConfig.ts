import { useState } from "react";
import type { ActivityMode, GreeterConfig, SocialConfig, ValenceInputMode } from "../../../types";
import type PartySocket from "partysocket";

export function useRoomConfig(socket: PartySocket) {
  const [avatarStyle, setAvatarStyle]         = useState<string | null>(null);
  const [colorCursorsByVote, setColorCursorsByVote] = useState<boolean>(false);
  const [defaultCursorColor, setDefaultCursorColor] = useState<string>('#d4d4d4');
  const [ownValenceDisplay, setOwnValenceDisplay] = useState<'background' | 'labels' | 'none'>('labels');
  const [valenceInputMode, setValenceInputMode] = useState<ValenceInputMode>('touch');
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
  const [greeterConfig, setGreeterConfig]     = useState<GreeterConfig | null>(null);
  const [greeterConfigOpen, setGreeterConfigOpen] = useState(false);
  const [userCap, setUserCap]                 = useState<number | null>(null);
  const [capInput, setCapInput]               = useState<string>('');

  const sendAvatarStyle = (style: string | null) => {
    setAvatarStyle(style);
    socket.send(JSON.stringify({ type: 'setRoomAvatarStyle', avatarStyle: style }));
  };

  const sendColorCursorsByVote = (enabled: boolean) => {
    setColorCursorsByVote(enabled);
    socket.send(JSON.stringify({ type: 'setColorCursorsByVote', enabled }));
  };

  const sendDefaultCursorColor = (color: string) => {
    setDefaultCursorColor(color);
    socket.send(JSON.stringify({ type: 'setDefaultCursorColor', color }));
  };

  const sendOwnValenceDisplay = (mode: 'background' | 'labels' | 'none') => {
    setOwnValenceDisplay(mode);
    socket.send(JSON.stringify({ type: 'setOwnValenceDisplay', mode }));
  };

  const sendValenceInputMode = (mode: ValenceInputMode) => {
    setValenceInputMode(mode);
    socket.send(JSON.stringify({ type: 'setValenceInputMode', mode }));
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

  const sendGreeterConfig = (config: GreeterConfig) => {
    setGreeterConfig(config);
    socket.send(JSON.stringify({ type: 'setGreeterConfig', config }));
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
    if ('colorCursorsByVote' in data) setColorCursorsByVote((data.colorCursorsByVote as boolean) ?? true);
    if ('defaultCursorColor' in data && data.defaultCursorColor) setDefaultCursorColor(data.defaultCursorColor as string);
    if ('ownValenceDisplay' in data && data.ownValenceDisplay) setOwnValenceDisplay(data.ownValenceDisplay as 'background' | 'labels' | 'none');
    if ('valenceInputMode' in data && data.valenceInputMode) setValenceInputMode(data.valenceInputMode as ValenceInputMode);
    if ('currentActivity' in data) setActivity((data.currentActivity as ActivityMode) ?? 'canvas');
    if ('roomImageUrl' in data) setRoomImageUrl((data.roomImageUrl as string) ?? '');
    if ('roomSocialConfig' in data) setRoomSocialConfig((data.roomSocialConfig as SocialConfig | null) ?? null);
    if ('greeterConfig' in data) setGreeterConfig((data.greeterConfig as GreeterConfig | null) ?? null);
    if ('soccerScore' in data && data.soccerScore) setSoccerScore(data.soccerScore as { left: number; right: number });
    if (data.userCap !== undefined) {
      setUserCap(data.userCap as number | null);
      setCapInput(data.userCap !== null ? String(data.userCap) : '');
    }
  };

  const handleSocketEvent = (data: Record<string, unknown>) => {
    if (data.type === 'defaultCursorColorChanged') {
      setDefaultCursorColor(data.defaultCursorColor as string);
    } else if (data.type === 'colorCursorsByVoteChanged') {
      setColorCursorsByVote(data.colorCursorsByVote as boolean);
    } else if (data.type === 'roomAvatarStyleChanged') {
      setAvatarStyle((data.avatarStyle as string | null) ?? null);
    } else if (data.type === 'activityChanged') {
      setActivity((data.activity as ActivityMode) ?? 'canvas');
    } else if (data.type === 'imageUrlChanged') {
      setRoomImageUrl((data.url as string) ?? '');
    } else if (data.type === 'socialConfigChanged') {
      setRoomSocialConfig((data.config as SocialConfig | null) ?? null);
    } else if (data.type === 'greeterConfigChanged') {
      setGreeterConfig((data.config as GreeterConfig | null) ?? null);
    } else if (data.type === 'goalScored') {
      setSoccerScore(data.score as { left: number; right: number });
    } else if (data.type === 'userCapChanged') {
      setUserCap(data.cap as number | null);
      setCapInput(data.cap !== null ? String(data.cap) : '');
    } else if (data.type === 'ownValenceDisplayChanged') {
      setOwnValenceDisplay(data.ownValenceDisplay as 'background' | 'labels' | 'none');
    } else if (data.type === 'valenceInputModeChanged') {
      setValenceInputMode(data.valenceInputMode as ValenceInputMode);
    }
  };

  return {
    avatarStyle, setAvatarStyle,
    colorCursorsByVote, setColorCursorsByVote,
    sendColorCursorsByVote,
    defaultCursorColor, setDefaultCursorColor,
    sendDefaultCursorColor,
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
    greeterConfig, setGreeterConfig,
    greeterConfigOpen, setGreeterConfigOpen,
    sendGreeterConfig,
    resetSoccerScore,
    sendUserCap,
    applyConnected,
    handleSocketEvent,
    canvasSettingsOpen, setCanvasSettingsOpen,
    showNowLabelOnCanvas, setShowNowLabelOnCanvas,
    ownValenceDisplay, setOwnValenceDisplay,
    sendOwnValenceDisplay,
    valenceInputMode, setValenceInputMode,
    sendValenceInputMode,
  };
}
