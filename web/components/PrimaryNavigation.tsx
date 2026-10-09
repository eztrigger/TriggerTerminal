"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {tr} from '../lib/i18n';
export const primaryPages=[['/','交易台'],['/holdings','仓位与分析'],['/crypto-holdings','虚拟货币的持仓']] as const;
export default function PrimaryNavigation(){
 const pathname=usePathname();
 return <nav className="terminal-primary-nav" aria-label={tr('主导航')}>{primaryPages.map(([href,label])=><Link key={href} href={href} className="term-btn" aria-current={pathname===href?'page':undefined}>{tr(label)}</Link>)}</nav>;
}
