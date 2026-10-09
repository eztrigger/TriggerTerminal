"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {initializeLanguage,LANGUAGE_KEY,tr,syncDesktopLanguage} from '../lib/i18n';

import {restoreAnalysisCache,persistAnalysisCache} from '../lib/analysis-cache';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const language=initializeLanguage();
    document.documentElement.lang=language;
    document.title=tr('TriggerTerminal');
    syncDesktopLanguage();
    restoreAnalysisCache(client);
    const stopCache=persistAnalysisCache(client);
    setReady(true);
    const changed=(event:StorageEvent)=>{if(event.key===LANGUAGE_KEY)window.location.reload();};
    window.addEventListener('storage',changed);
    return()=>{stopCache();window.removeEventListener('storage',changed);};
  },[]);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 10_000,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{ready?children:null}</QueryClientProvider>;
}
