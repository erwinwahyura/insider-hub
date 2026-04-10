/**
 * Insider Hub — PTPS Q1 2026 Earnings Watcher
 * Monitors BEI and pertamina-ptk.com for Q1 2026 report release
 * Notifies immediately when "Laporan Keuangan 2026" or "Q1 2026" PDF appears
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';

const WATCHER_FILE = './src/content/data/earnings-watch.json';
const DATA_DIR = 'src/content/data';

// PTPS ticker info
const PTPS = {
  ticker: 'PTPS',
  name: 'PT Pulau Subur Tbk',
  q1Due: '2026-04-30', // Estimated deadline (30 April)
  beiUrl: 'https://www.idx.co.id/id/perusahaan-tercatat/keuangan-laporan/PTPS',
  corporateUrl: 'https://pertamina-ptk.com/investor-relations/laporan-keuangan/',
  keywords: ['2026', 'Q1', 'I/2026', 'Laporan Keuangan', 'Financial Report', 'Tahunan 2025'],
  watchNotes: ['CALK 15 (c)', 'Pihak Berelasi', 'Utang Usaha', 'Aset Biologis']
};

const PGEO = {
  ticker: 'PGEO',
  name: 'Pertamina Geothermal Energy',
  earningsDate: '2026-04-24', // Confirmed
  beIurl: 'https://www.idx.co.id/id/perusahaan-tercatat/keuangan-laporan/PGEO',
  corporateUrl: 'https://pertamina-geothermal.com/investor-relations/'
};

async function loadWatchState() {
  if (!existsSync(WATCHER_FILE)) {
    return {
      lastCheck: null,
      ptpsQ1Found: false,
      pgeoQ1Found: false,
      notifications: [],
      notes: []
    };
  }
  try {
    const raw = readFileSync(WATCHER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      lastCheck: null,
      ptpsQ1Found: false,
      pgeoQ1Found: false,
      notifications: [],
      notes: []
    };
  }
}

async function saveWatchState(state) {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  state.lastCheck = new Date().toISOString();
  await writeFile(WATCHER_FILE, JSON.stringify(state, null, 2));
}

async function checkPTPSCorporateSite() {
  // Check pertamina-ptk.com for new reports
  try {
    const res = await fetch(PTPS.corporateUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Look for 2026 or Q1 indicators
    const has2026 = /2026|Q1|I\/2026/i.test(html);
    const hasQ1Pattern = /3[\s/-]*bulan|tri[\s-]*wulan|quarter[\s-]*1/i.test(html);
    
    // Check for PDF links
    const pdfLinks = [...html.matchAll(/href="([^"]*\.pdf)"/gi)].map(m => m[1]);
    const relevantPdfs = pdfLinks.filter(url => 
      /2026|Q1|financial|keuangan|tahunan/i.test(url)
    );
    
    return {
      accessible: true,
      has2026Content: has2026,
      hasQ1Content: hasQ1Pattern,
      pdfCount: relevantPdfs.length,
      pdfs: relevantPdfs.slice(0, 5) // First 5 PDFs
    };
  } catch (e) {
    return { accessible: false, error: e.message };
  }
}

async function checkIDXSite(ticker) {
  // IDX blocks Cloudflare IPs, we'll note this and rely on corporate site + user updates
  return {
    accessible: false,
    note: 'IDX blocks container IPs — use browser check or wait for BEI public feed'
  };
}

async function checkEarnings() {
  console.log('Checking Q1 2026 earnings availability...\n');
  
  const state = await loadWatchState();
  const now = new Date();
  
  // Days until deadline
  const q1Deadline = new Date(PTPS.q1Due);
  const daysUntil = Math.ceil((q1Deadline - now) / (1000 * 60 * 60 * 24));
  
  console.log(`📅 PTPS Q1 2026`);
  console.log(`   Deadline: ${PTPS.q1Due} (${daysUntil} days)`);
  console.log(`   Key items: ${PTPS.watchNotes.join(', ')}`);
  
  // Check corporate site
  const ptpsStatus = await checkPTPSCorporateSite();
  
  if (ptpsStatus?.accessible) {
    console.log(`   Corporate site: ✅ Accessible`);
    console.log(`   2026 content: ${ptpsStatus.has2026Content ? '⚠️ FOUND' : '❌ Not yet'}`);
    console.log(`   Q1 indicators: ${ptpsStatus.hasQ1Content ? '⚠️ FOUND' : '❌ Not yet'}`);
    console.log(`   PDFs found: ${ptpsStatus.pdfCount}`);
    
    if (ptpsStatus.pdfs.length > 0) {
      console.log(`   PDF links:`);
      ptpsStatus.pdfs.forEach(pdf => console.log(`     - ${pdf}`));
    }
    
    // Trigger if 2026 or Q1 content detected
    if ((ptpsStatus.has2026Content || ptpsStatus.hasQ1Content) && !state.ptpsQ1Found) {
      state.ptpsQ1Found = true;
      state.notifications.push({
        type: 'PTPS_Q1_DETECTED',
        ticker: 'PTPS',
        message: '🚨 PTPS Q1 2026 report may be available!',
        pdfs: ptpsStatus.pdfs,
        timestamp: now.toISOString(),
        priority: 'critical',
        action: `Check ${PTPS.corporateUrl} for CALK 15(c) and related party payables`
      });
      console.log(`\n   🚨 NOTIFICATION: Q1 2026 content detected!`);
    }
  } else {
    console.log(`   Corporate site: ❌ ${ptpsStatus?.error || 'Blocked/Unavailable'}`);
    console.log(`   Note: Use browser to check ${PTPS.corporateUrl}`);
  }
  
  // Check PGEO
  const pgeoDays = Math.ceil((new Date(PGEO.earningsDate) - now) / (1000 * 60 * 60 * 24));
  console.log(`\n📅 PGEO Q1 2026`);
  console.log(`   Date: ${PGEO.earningsDate} (${pgeoDays} days)`);
  console.log(`   Status: ${pgeoDays <= 0 ? '⚠️ DUE TODAY' : '⏳ Upcoming'}`);
  
  // Save state
  await saveWatchState(state);
  
  console.log(`\n📊 Watch state saved`);
  console.log(`   PTPS Q1 found: ${state.ptpsQ1Found ? '✅ YES' : '⏳ Not yet'}`);
  console.log(`   Notifications: ${state.notifications.length}`);
  
  if (state.notifications.length > 0) {
    const last = state.notifications[state.notifications.length - 1];
    console.log(`   Last alert: ${last.message}`);
  }
  
  return {
    ptps: { daysUntil, q1Detected: state.ptpsQ1Found },
    pgeo: { daysUntil: pgeoDays },
    notifications: state.notifications
  };
}

// Main execution
async function main() {
  try {
    const result = await checkEarnings();
    
    // Exit with code 1 if new earnings detected (to trigger notification)
    if (result.notifications.length > 0) {
      const recent = result.notifications.filter(n => {
        const hoursAgo = (Date.now() - new Date(n.timestamp)) / (1000 * 60 * 60);
        return hoursAgo < 24;
      });
      
      if (recent.length > 0) {
        console.log(`\n🔔 ${recent.length} new notification(s) to send`);
        process.exit(2); // Special code for "new earnings found"
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Earnings check failed:', e.message);
    process.exit(1);
  }
}

main();
