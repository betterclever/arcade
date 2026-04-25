const screenshot = "./assets/submission-screenshot.png";

const slides = [
  {
    className: "cover",
    body: `
      <div class="cover-copy">
        <h1>arcAd(e)</h1>
        <h2>Agent-bid dynamic ads<br />for real games</h2>
        <p>Autonomous brand agents bid in USDC for live in-game surfaces. The winning prompt becomes billboard creative streamed into play.</p>
      </div>
      <div class="cover-chip mono">Arc + USDC + Nanopayments/x402</div>
      <figure class="screenshot-frame cover-shot"><img src="${screenshot}" alt="arcAd(e) live game demo" /></figure>
      <span class="page-num">01</span>
    `,
  },
  {
    className: "problem",
    body: `
      <section class="problem-main">
        <h1>Game ads are<br />still sold too slow</h1>
        <p>A five-minute billboard opportunity still gets treated like a campaign: sales process, creative handoff, high minimum spend, and slow settlement.</p>
      </section>
      <div class="problem-list">
        <div class="problem-item"><span class="num mono">01</span><div><strong>Static inventory</strong><span>Surfaces are sold manually or hardcoded.</span></div></div>
        <div class="problem-item"><span class="num mono">02</span><div><strong>Tiny value, big friction</strong><span>Sub-cent bids break normal payment assumptions.</span></div></div>
        <div class="problem-item"><span class="num mono">03</span><div><strong>Agents need rails</strong><span>Autonomous buyers need verifiable API-native payments.</span></div></div>
      </div>
      <aside class="problem-right">
        <h2>Bought like<br />compute</h2>
        <p>Programmatic, frequent, low-value, and receipt-backed.</p>
      </aside>
      <span class="page-num">02</span>
    `,
  },
  {
    className: "",
    header: "How it works",
    body: `
      <h1 class="loop-title">One auction loop, from agent intent to live texture</h1>
      <div class="flow">
        <div class="flow-card"><span class="num mono">1</span><strong>Game SDK</strong><span>Register surface<br />and stream updates</span></div>
        <div class="flow-card"><span class="num mono">2</span><strong>Brand agent</strong><span>Prices exposure<br />and decides to bid</span></div>
        <div class="flow-card"><span class="num mono">3</span><strong>x402 payment</strong><span>Signs tiny USDC<br />authorization</span></div>
        <div class="flow-card"><span class="num mono">4</span><strong>Auction server</strong><span>Verifies, ranks,<br />and closes round</span></div>
        <div class="flow-card"><span class="num mono">5</span><strong>Creative render</strong><span>Winning prompt<br />becomes texture</span></div>
      </div>
      <p class="loop-caption">arcAd(e) makes the ad surface a market endpoint: agents pay to act, the server verifies payment, and the game updates live.</p>
      <span class="page-num">03</span>
    `,
  },
  {
    className: "",
    theme: "blueprint",
    header: "Payment layer",
    body: `
      <section class="payments-title">
        <h1>Tiny payments<br />for agent actions</h1>
        <p>Each bid endpoint can issue an x402 payment requirement. The buyer agent signs a Circle Gateway authorization, retries the request, and arcAd(e) records the receipt before accepting the bid.</p>
      </section>
      <div class="benefits">
        <div class="benefit"><span class="dot"></span><div><strong>Sub-cent economics</strong><span>A bid can cost fractions of a cent without turning into a settlement problem.</span></div></div>
        <div class="benefit"><span class="dot"></span><div><strong>Agent-native flow</strong><span>No checkout UI: the agent receives a challenge, signs, and continues.</span></div></div>
        <div class="benefit"><span class="dot"></span><div><strong>Auditable receipts</strong><span>Every paid action can carry payer, amount, network, asset, and verification data.</span></div></div>
      </div>
      <aside class="receipt">
        <h2>x402 authorization</h2>
        <div class="receipt-row"><span class="mono">Network</span><strong>eip155:5042002</strong></div>
        <div class="receipt-row"><span class="mono">Asset</span><strong>Arc Testnet USDC</strong></div>
        <div class="receipt-row"><span class="mono">Action</span><strong>bid / increase</strong></div>
        <div class="receipt-row"><span class="mono">Payer</span><strong>agent wallet</strong></div>
        <div class="receipt-row"><span class="mono">Verification</span><strong>isValid: true</strong></div>
      </aside>
      <span class="page-num">04</span>
    `,
  },
  {
    className: "proof",
    body: `
      <figure class="screenshot-frame proof-shot"><img src="${screenshot}" alt="arcAd(e) current demo with live bids" /></figure>
      <section class="proof-copy">
        <h1>Live demo<br />proof</h1>
        <p>Two bidder agents competed for one roadside billboard.</p>
        <div class="proof-table">
          <div class="proof-row"><strong>VoltRush</strong><span class="mono">$0.002 opening bid</span></div>
          <div class="proof-row"><strong>Northline</strong><span class="mono">$0.002 opening bid</span></div>
          <div class="proof-row"><strong>Northline</strong><span class="mono">+$0.001 increase</span></div>
          <div class="proof-row"><strong>VoltRush</strong><span class="mono">$0.004 held lead</span></div>
        </div>
        <p class="proof-note">This is the core story: agents watch the market, reason about value, pay per action, and react to competition.</p>
      </section>
      <span class="page-num">05</span>
    `,
  },
  {
    className: "",
    theme: "paper",
    body: `
      <h1 class="architecture-title">arcAd(e) is a platform,<br />not just a demo scene</h1>
      <div class="architecture-grid">
        <section class="layer"><h2>Game layer</h2><p>React + Three.js demo<br />Arcade SDK<br />SSE texture updates</p></section>
        <section class="layer"><h2>Market layer</h2><p>Surfaces, rounds, bids<br />Payment ledger<br />Winner selection</p></section>
        <section class="layer"><h2>Agent layer</h2><p>CLI + bidder skill<br />Wallet / Gateway flow<br />Budget-aware loop</p></section>
        <section class="layer"><h2>Proof layer</h2><p>Arc contract events<br />Bid records<br />Placement finalization</p></section>
      </div>
      <p class="architecture-caption">Everything points at one interface: a live game surface that autonomous buyers can discover, price, pay for, and update.</p>
      <span class="page-num">06</span>
    `,
  },
  {
    className: "",
    body: `
      <section class="next-title">
        <h1>What comes next</h1>
        <h2>Make every game surface a programmable market.</h2>
      </section>
      <div class="next-list">
        <div class="next-item"><span class="dot"></span><div><strong>Policy + moderation</strong><br /><span>Publisher-safe generated creative before render.</span></div></div>
        <div class="next-item"><span class="dot"></span><div><strong>On-chain proof</strong><br /><span>Record bids, increases, and placements through the Arc contract path.</span></div></div>
        <div class="next-item"><span class="dot"></span><div><strong>More engines</strong><br /><span>Unity, Unreal, and web game SDKs.</span></div></div>
        <div class="next-item"><span class="dot"></span><div><strong>Per-view settlement</strong><br /><span>Move from bid actions to live exposure pricing.</span></div></div>
      </div>
      <aside class="brand-plate">
        <h1>arcAd(e)</h1>
        <h2>Agent-bid dynamic ads<br />for real games</h2>
        <p>Built with Arc, USDC, Circle Gateway, Nanopayments/x402, Bun, React, and Three.js.</p>
      </aside>
      <span class="page-num">07</span>
    `,
  },
];

const params = new URLSearchParams(window.location.search);
const slideIndex = Math.max(0, Math.min(slides.length - 1, Number(params.get("slide") ?? "1") - 1));
const slide = slides[slideIndex];
const root = document.getElementById("deck");

root.innerHTML = `
  <article class="slide ${slide.className}" data-theme="${slide.theme ?? ""}">
    ${slide.header ? `<span class="brand mono">arcAd(e)</span><span class="section mono">${slide.header}</span><span class="rule"></span>` : ""}
    ${slide.body}
  </article>
`;
