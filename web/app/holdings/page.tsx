"use client";
import {tr,uiLocale} from "../../lib/i18n";
import Holdings from '../../components/widgets/ManualPortfolioWidget';
import '../analysis/analysis.css';
export default function Page(){return <main className="holdings-page holdings-home"><div className="holdings-page-inner"><header className="holdings-home-header"><h1>{tr("仓位与分析")}</h1></header><Holdings/></div></main>;}
