"use client";

import React, { useState } from "react";
import styles from "./YourSucculentsArticle.module.css";

export default function YourSucculentsArticle() {
  const [activeTab, setActiveTab] = useState("plains");
  const [quizResult, setQuizResult] = useState<""|"dry"|"moist">("");

  function showTab(id: string) {
    setActiveTab(id);
  }
  function showQuizResult(kind: "dry"|"moist"){
    setQuizResult(kind);
  }

  return (
    <article className={styles.wrap}>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}><span className={styles.brandDot}></span>Succulent Sphere</div>
          <nav className={styles.tocPills}>
            <a href="#unboxing">Unboxing</a>
            <a href="#potting">Potting</a>
            <a href="#watering">Watering</a>
            <a href="#climate">Your climate</a>
            <a href="#faq">FAQ</a>
          </nav>
        </div>
      </div>

      <header style={{paddingTop:24}}>
        <span className={styles.stamp}>Handle with care — live plants</span>
        <h1 className={styles.heroH1}>Your succulents just landed. Here's what to do in the next 30 minutes.</h1>
        <p className={styles.lede}>Not a generic care sheet copied off Google — this is exactly how we pack your order at Succulent Sphere, and exactly what to do when you open the box, wherever in India you happen to be unwrapping it.</p>
        <div className={styles.metaRow}>
          <span>Succulent care</span><span>·</span><span>7 min read</span><span>·</span><span>Updated for 2026</span>
        </div>
      </header>

      <div className={styles.quickAnswer}>
        <div className={styles.sectionLabel}>Quick answer</div>
        <p>Open the box in the shade, not in direct sun. Unwrap gently — don't yank leaves stuck to the paper. Don't water on day one. Pot bare-root plants in a well-draining cactus mix within 24–48 hours, then keep them out of harsh sun for about a week before moving them to their final bright spot.</p>
      </div>

      <section id="why">
        <div className={styles.sectionLabel}>Before you open the box</div>
        <h2>Why we ship bare-root — and why your plant looks a little sorry for itself</h2>
        <p>Here's exactly what happened to your order before it reached your door. We pull the plant, shake off the growing medium, and let the roots air-dry for a bit — not rush it, actually dry. Wet roots sealed in a dark box for a week is how you get a mushy, rotten stem instead of a living plant. Once the roots are dry, we wrap them in tissue paper to cushion them and soak up any last bit of moisture, then wrap the whole plant in newspaper for padding, and box it up. From our end to your doorstep, that's usually <strong>4 to 7 days</strong> depending on where you are.</p>
        <p>No soil in transit means no soggy mess, no mould, and no soil-borne pests hitching a ride into your home. It also means your plant hasn't seen light, fresh air, or water in nearly a week. So if it looks a bit limp, a leaf or two has dropped off, or the colour looks duller than the photo on our site — that's normal. It's tired, not dead. Give it a week before you panic and message us.</p>
      </section>

      <section id="unboxing">
        <div className={styles.sectionLabel}>The first 30 minutes</div>
        <h2>Unbox it like you actually mean it</h2>
        <p>Most people tear into the box the second the delivery guy leaves, plonk the plant on a sunny windowsill "so it can breathe," and water it immediately out of guilt. That combination is exactly how a plant that survived a week in transit dies on day one. Do this instead:</p>
        <ol className={styles.steps}>
          <li><b>Open it somewhere shaded.</b> Not your sunniest balcony spot. A kitchen counter or a shaded corner of the room is fine.</li>
          <li><b>Unwrap the newspaper first, then the tissue.</b> Go slow near the base — leaves love sticking to tissue paper, and you'll rip one off if you rush.</li>
          <li><b>Don't panic at fallen leaves or a wrinkled look.</b> A shrivelled leaf just means it used its own water reserves during transit. It'll plump back up once it's settled.</li>
          <li><b>Check the roots.</b> Firm and pale-to-tan is good. Black, mushy, or foul-smelling bits should be snipped off with a clean pair of scissors.</li>
          <li><b>If anything looks actually damaged — a snapped stem, a crushed rosette — photograph it right away</b> before you do anything else. That photo is what we'll need if you reach out for a replacement.</li>
        </ol>
      </section>

      <section id="potting">
        <div className={styles.sectionLabel}>Day one to day two</div>
        <h2>Should you pot it immediately, or wait?</h2>
        <p>Pot within 24–48 hours. Bare roots left sitting out too long will dry out and die back, and roots that were freshly trimmed need a day or so to callus over — think of it like a scab forming — before they touch damp soil, or they'll rot. So the sequence is: unbox, inspect, let any cut ends air-dry for a day if you trimmed roots, then pot.</p>
        <p>Use an actual well-draining cactus and succulent mix, not the black garden soil sold for vegetable beds. Garden soil holds water for days, and a succulent root sitting in wet soil for that long is basically asking to rot. A mix that's roughly two-thirds mineral (coarse sand, perlite, pumice) to one-third organic material drains the way these plants actually need. Pot with a container that has a drainage hole — no exceptions, even for the cute ceramic one without a hole. If you love that pot, use it as an outer cachepot and keep the plant in a plastic nursery pot with drainage inside it.</p>
        <blockquote>Do not water the day you pot it. I know that feels wrong. Do it anyway.</blockquote>
        <p>Freshly potted roots, especially ones with any cut or torn ends, need a few dry days before their first drink. Watering immediately is the single most common way people undo everything they just did right.</p>
      </section>

      <section id="week-one">
        <div className={styles.sectionLabel}>The first week</div>
        <h2>Shade before sun — always in that order</h2>
        <p>Your succulent spent close to a week in a dark box. Its cells aren't ready for harsh, direct afternoon sun on day one — that's how you get sunburn, which shows up as pale, bleached, or brown patches that won't go away. Keep it in bright but indirect light for the first 4–7 days: near a window, under a covered veranda, or in filtered light through a curtain. Then start introducing an hour or two of gentle morning sun, and build up gradually over the following week or two until it's in its ideal spot.</p>
        <p>One more thing — pick one spot and leave it there. Succulents don't love being shuffled around the house every day. Constantly changing light direction confuses the plant just as it's trying to settle in.</p>
      </section>

      <section id="watering">
        <div className={styles.sectionLabel}>The rule everyone breaks</div>
        <h2>Watering: less often than you think, more thoroughly than you'd guess</h2>
        <p>Succulents store water in their leaves and stems. That's the entire point of the plant. Watering on a fixed weekly schedule, the way you'd water a tulsi or a money plant, is the number one reason new succulent owners lose their plants within a month. The rule is simple even if it's hard to follow: <strong>water only when the soil is completely dry, then water it properly</strong> — soak the soil until it runs out of the drainage hole, not a token sprinkle on top.</p>

        <div className={styles.quiz}>
          <div className={styles.quizQ}>Quick check — is it actually time to water?</div>
          <div className={styles.quizBtns}>
            <button className={styles.quizBtn} onClick={() => showQuizResult('dry')}>Soil is bone dry, even 2 inches down</button>
            <button className={styles.quizBtn} onClick={() => showQuizResult('moist')}>Still feels a bit cool or moist</button>
          </div>
          <div id="quiz-result" className={quizResult?styles.quizResultShow:styles.quizResult}>
            <span id="quiz-text">
              {quizResult === 'dry' ? (<><strong>Go for it.</strong> Water thoroughly until it runs out of the drainage hole, then don't touch it again until it's fully dry once more.</>) : quizResult === 'moist' ? (<><strong>Wait a few more days.</strong> Damp soil around succulent roots for too long is exactly how rot starts. Check again in 2–3 days.</>) : null}
            </span>
          </div>
        </div>

        <p>For a freshly arrived plant, that first proper watering usually happens somewhere around day 5 to day 10 after potting — not on a calendar date, on however long your soil, pot, and weather actually take to dry out. A terracotta pot in Jaipur in May dries out in two days. A plastic pot in Kochi in August might take two weeks. There's no universal number, which is exactly why the "water every Sunday" approach fails.</p>
      </section>

      <section id="climate">
        <div className={styles.sectionLabel}>This is the part most guides skip</div>
        <h2>Succulent care actually changes depending on where in India you live</h2>
        <p>A care guide written for a Californian greenhouse doesn't hold up in a Chennai flat in August, and honestly, most of the "succulent care" content online is written for a climate nothing like ours. Tap your region below.</p>

        <div className={styles.tabsNav} role="tablist">
          <button className={`${styles.tabBtn} ${activeTab === 'plains' ? styles.tabBtnActive : ''}`} onClick={() => showTab('plains')}>North Indian Plains</button>
          <button className={`${styles.tabBtn} ${activeTab === 'coastal' ? styles.tabBtnActive : ''}`} onClick={() => showTab('coastal')}>Coastal &amp; Humid</button>
          <button className={`${styles.tabBtn} ${activeTab === 'hills' ? styles.tabBtnActive : ''}`} onClick={() => showTab('hills')}>Hills &amp; Cooler Regions</button>
          <button className={`${styles.tabBtn} ${activeTab === 'monsoon' ? styles.tabBtnActive : ''}`} onClick={() => showTab('monsoon')}>Monsoon, Everywhere</button>
        </div>

        <div id="tab-plains" className={`${styles.tabPanel} ${activeTab === 'plains' ? styles.tabPanelActive : ''}`}>
          <h3>Delhi-NCR, Punjab, UP, Rajasthan, MP</h3>
          <p>Your problem in summer isn't too little sun — it's too much, too intense, for too many hours. Once temperatures cross the high 30s and 40s°C, move plants out of the harsh 12–4pm sun even though succulents are technically "sun-loving" — this isn't the gentle sun they evolved for. Morning sun with afternoon shade works better than a full-day sun-blast in May and June. You'll also water more often here in peak summer, since terracotta pots on a hot balcony can dry out in a day or two. Winters flip the problem: cold, dry air and the occasional frost in December–January can damage frost-sensitive varieties like some Echeverias — bring pots indoors or near a wall on the coldest nights.</p>
        </div>

        <div id="tab-coastal" className={`${styles.tabPanel} ${activeTab === 'coastal' ? styles.tabPanelActive : ''}`}>
          <h3>Mumbai, Chennai, Kolkata, Kerala, Goa</h3>
          <p>Humidity is your actual enemy here, not heat. High moisture in the air means the soil takes far longer to dry between waterings, so the biggest risk isn't underwatering — it's rot from soil that never fully dries out. Prioritise airflow: don't crowd pots together, and skip a saucer that lets water sit under the pot. A slightly grittier mix than usual — more perlite or pumice — helps a lot here. Water less frequently than you'd expect, and check the soil with a finger or a wooden skewer before assuming it needs a drink.</p>
        </div>

        <div id="tab-hills" className={`${styles.tabPanel} ${activeTab === 'hills' ? styles.tabPanelActive : ''}`}>
          <h3>Uttarakhand, Himachal, and the Northeast hills</h3>
          <p>Honestly, this is closer to where a lot of succulents are naturally comfortable — cooler days, decent light, less brutal heat. The main things to watch for are heavier rainfall in monsoon and cold snaps in winter. Keep pots under some kind of cover during heavy rain spells, and if temperatures drop close to freezing, move sensitive plants indoors or near a warm wall overnight.</p>
        </div>

        <div id="tab-monsoon" className={`${styles.tabPanel} ${activeTab === 'monsoon' ? styles.tabPanelActive : ''}`}>
          <h3>June to September, wherever you are</h3>
          <p>Monsoon kills more succulents in India than any other single season, full stop. Constant humidity, days without direct sun, and soil that doesn't dry out for a week at a time is a rot factory. Cut watering right back — often to almost nothing if the air is already humid. Move pots somewhere covered: under an overhang, near a window indoors, anywhere rain can't fall directly into the pot. If you notice mushy, translucent, or blackened leaves near the base during monsoon, that's rot starting — remove the affected leaves immediately and hold off on water completely until things dry out.</p>
        </div>
      </section>

      <section id="mistakes">
        <div className={styles.sectionLabel}>Learn from other people's plants</div>
        <h2>The mistakes we see over and over</h2>
        <ul className={styles.mistakes}>
          <li><span className={styles.xMark}>✕</span><span><strong>Watering the day it arrives.</strong> It survived a week without water. One more day won't hurt it — overwatering on day one might.</span></li>
          <li><span className={styles.xMark}>✕</span><span><strong>Straight into full sun "to help it recover."</strong> This does the opposite. Shade first, always.</span></li>
          <li><span className={styles.xMark}>✕</span><span><strong>Parking it right in front of an AC vent.</strong> Cold, dry, constant airflow stresses succulents just as much as heat does.</span></li>
          <li><span className={styles.xMark}>✕</span><span><strong>Using leftover garden soil</strong> because buying a proper mix feels like an unnecessary extra step. It isn't extra — it's the difference between a plant that lasts a year and one that rots in three weeks.</span></li>
          <li><span className={styles.xMark}>✕</span><span><strong>Watering more because it "still looks sad."</strong> A stressed succulent almost always needs less water and more time, not more water.</span></li>
        </ul>
      </section>

      <section id="help">
        <div className={styles.sectionLabel}>If something actually went wrong</div>
        <h2>When to reach out to us</h2>
        <p>A few dropped leaves or a slightly dull colour on arrival is normal — give it a week. But if you unbox a snapped rosette, a stem that's clearly broken, or roots that are entirely black and mushy right out of the box, don't try to fix it yourself first. Photograph it as-is, before you trim or repot anything, and message us within 48 hours of delivery. We'd rather send a replacement than have you nurse a plant that had a rough trip.</p>
        <div className={styles.card}>
          <a className={"pill-link"} href="/contact">Contact us about a damaged order</a>
          <a className={"pill-link"} href="/shop" style={{marginLeft:12}}>Browse the shop</a>
          <a className={"pill-link"} href="/blog/succulent-care-guide" style={{marginLeft:12}}>Read our full care guide</a>
        </div>
      </section>

      <section id="faq">
        <div className={styles.sectionLabel}>Quick questions</div>
        <h2>Frequently asked</h2>

        <details>
          <summary>How long can a bare-root succulent survive without soil?</summary>
          <p>Healthy, properly dried roots can usually hold on for a week to ten days without soil, which is exactly why bare-root shipping works for a 4–7 day transit. Beyond two weeks unpotted, though, most plants start losing condition, so pot within a couple of days of arrival rather than leaving it sitting around.</p>
        </details>
        <details>
          <summary>Why did a few leaves fall off during shipping?</summary>
          <p>Movement, pressure from packing material, and the plant drawing on its own leaf-stored water to survive the trip all play a part. A couple of dropped or slightly shrivelled leaves is completely normal and not a sign the plant is dying.</p>
        </details>
        <details>
          <summary>Can I just use the soil from my garden?</summary>
          <p>Not really. Garden soil is built to hold moisture for vegetables and flowering plants — exactly what a succulent root doesn't want. Use a proper cactus and succulent mix, or a regular potting mix cut with an equal amount of coarse sand or perlite to open up the drainage.</p>
        </details>
        <details>
          <summary>Should I feed it fertiliser right after it arrives?</summary>
          <p>No. Let it settle for at least three to four weeks first. A stressed, newly potted plant isn't actively growing yet, and feeding it too early can actually burn the roots rather than help them.</p>
        </details>
        <details>
          <summary>My succulent looks wrinkled and thin. Is it dying?</summary>
          <p>Wrinkled, slightly deflated-looking leaves usually mean the plant is thirsty and drawing down its water reserves — common after transit. Pot it, wait for the soil to be fully dry, then water thoroughly. It should plump back up within a week or two. If it's mushy instead of wrinkled, that's rot, not thirst, and it's a different problem entirely.</p>
        </details>
      </section>

      <div className={styles.closing}>
        <h2>That's genuinely it.</h2>
        <p>Shade for the first week, no water on day one, a proper draining mix, and a bit of patience while it settles into your climate. Most succulent deaths in the first month come down to one of those four things going wrong — not bad luck. Tag us on Instagram when you pot it up, we like seeing where our plants end up. And if anything about your specific order looks off, just <a href="/contact">message us</a> — we'd genuinely rather help than have you guess.</p>
      </div>

      <footer className={styles.footer}>
        Written by the Succulent Sphere team · Sources on soil and watering: <a href="https://extension.umn.edu/gardening-minnesota/cacti-and-succulents" target="_blank" rel="noopener">University of Minnesota Extension</a> and <a href="https://btarboretum.org/succulent-care-tips/" target="_blank" rel="noopener">Boyce Thompson Arboretum</a>.
      </footer>
    </article>
  );
}
