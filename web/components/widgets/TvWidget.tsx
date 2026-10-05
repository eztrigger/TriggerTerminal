"use client";

import {tr,uiLocale} from "../../lib/i18n";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

// Public HLS endpoints; availability can change. CNBC replacement is listed in
// https://github.com/iptv-org/iptv/blob/master/streams/us.m3u (checked 2026-09-24).
// These include third-party relays, not only broadcaster-owned CDNs.
const CHANNELS = [
  { id: "bloomberg", label: "Bloomberg TV", url: "https://liveprodusphoenixeast.global.ssl.fastly.net/USPhx-HD/Channel-TX-USPhx-AWS-virginia-1/Source-USPhx-16k-1-s6lk2-BP-07-02-81ykIWnsMsg_live.m3u8" },
  { id: "yahoo", label: "Yahoo Finance", url: "https://d1ewctnvcwvvvu.cloudfront.net/playlist.m3u8" },
  { id: "cnbc", label: "CNBC", url: "http://41.205.93.154/CNBC/index.m3u8" },
  { id: "cheddar", label: "Cheddar Business", url: "https://gpuserver3.tier1streams.com/CHEDDAR_BUSINESS/index.m3u8" },
  { id: "ndtv", label: "NDTV Profit", url: "https://ndtvprofit.akamaized.net/hls/live/2107404/ndtvprofit/master_1.m3u8" },
] as const;

export default function TvWidget() {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>(CHANNELS[0]);
  const [error, setError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const cnbcSources = ["http://41.205.93.154/CNBC/index.m3u8", "https://gpuserver3.tier1streams.com/CNBC/index.m3u8", "http://4.30.180.36:8420/cnbc/index.m3u8?token=test"];
  const sources = channel.id === "cnbc" ? cnbcSources : [channel.url];
  const [retry, setRetry] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    let stopped = false;
    const fail = (detail: string) => {
      if (stopped) return;
      stopped = true;
      if (channel.id === "cnbc" && sourceIndex + 1 < sources.length) setSourceIndex(i => i + 1);
      else setError(`直播线路暂不可用 (${detail})，请重新连接或切换频道。`);
    };
    let lastTime = video.currentTime;
    let lastProgress = Date.now();
    const watchdog = setInterval(() => {
      if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastProgress = Date.now(); }
      else if ((!video.paused || video.readyState < 2) && Date.now() - lastProgress > 25000) fail("播放超时");
    }, 2000);
    const cleanup = () => { stopped = true; clearInterval(watchdog); };
    const url = sources[sourceIndex] ?? sources[0];

    if (Hls.isSupported()) {
      const hls = new Hls({manifestLoadingTimeOut: 8000, manifestLoadingMaxRetry: 1, levelLoadingTimeOut: 8000, levelLoadingMaxRetry: 1});
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) fail(data.details);
      });
      return () => { cleanup(); hls.destroy(); };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      const onError = () => fail("视频加载失败");
      video.addEventListener("error", onError);
      video.play().catch(() => {});
      return () => { cleanup(); video.removeEventListener("error", onError); video.pause(); video.removeAttribute("src"); video.load(); };
    } else {
      cleanup(); setError("你的浏览器不支持 HLS 播放。");
    }
  }, [channel, retry, sourceIndex]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-1 flex-wrap shrink-0">
        {tr(CHANNELS.map((c) => (
          <button
            key={c.id}
            className={`term-btn ${channel.id === c.id ? "active" : ""}`}
            onClick={() => { setChannel(c); setSourceIndex(0); setRetry(n => n + 1); }}
          >
            {tr(c.label)}
          </button>
        )))}
      </div>
      {tr(channel.id === "cnbc" && <div className="flex items-center gap-2 px-2 py-1 dim"><span>{tr("CNBC · 线路 ")}{tr(sourceIndex + 1)} / {tr(sources.length)}{tr(" · 故障自动切换")}</span><button className="term-btn" onClick={() => {setSourceIndex(i => (i + 1) % sources.length);setRetry(n => n + 1);}}>{tr("切换线路")}</button></div>)}
      <div className="relative flex-1 min-h-0 bg-black">
        <video ref={videoRef} className="w-full h-full" autoPlay muted controls playsInline />
        {tr(error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center dim bg-black">
            <div><p role="alert">{tr(error)}</p><button className="term-btn mt-3" onClick={() => {setSourceIndex(0);setRetry(n => n + 1);}}>{tr("重新连接")}</button>{tr(channel.id === "cnbc" && <a className="term-btn ml-2" href="https://www.cnbc.com/live-tv/" target="_blank" rel="noopener noreferrer">{tr("CNBC 官方直播 ↗")}</a>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
