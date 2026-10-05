"use client";
import {useQuery} from '@tanstack/react-query';
import {apiGet} from './api';
export type SourceState={active:'api'|'yahoo';selected:'api'|'yahoo';restartRequired:boolean};
export function useMarketSource(){return useQuery({queryKey:['market-source'],queryFn:()=>apiGet<SourceState>('/api/market-source'),refetchInterval:10000});}
