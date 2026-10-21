import Image from "next/image";
import { MessagesSquare } from "lucide-react";
import { workAbroadLogos } from "@/data/work-abroad-logos";
import styles from "./CommunityMarquees.module.css";

const socialChannels: { name: string; icon: string | null; href?: string }[] = [
  { name: "Facebook", icon: "facebook-color", href: "https://www.facebook.com/profile.php?id=61560913240742" },
  { name: "Instagram", icon: "instagram-color" },
  { name: "TikTok", icon: "tiktok-color", href: "https://www.tiktok.com/@jobsincroatiaa" },
  { name: "Threads", icon: "threads" },
  { name: "X", icon: "x" },
  { name: "Reddit", icon: "reddit-color" },
  { name: "Forums", icon: null },
];

function SocialIcons({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className={`${styles.group} ${styles.socialGroup}`} aria-hidden={duplicate || undefined}>
      {socialChannels.map(({ name, icon, href }) => {
        const label = (
          <>
            <span className={styles.socialIcon} aria-hidden="true">
              {icon ? (
                <Image src={`/images/social/${icon}.svg`} alt="" width={28} height={28} loading="eager" />
              ) : (
                <MessagesSquare size={28} strokeWidth={1.7} />
              )}
            </span>
            <span className={name === "X" ? styles.screenReaderOnly : undefined}>{name}</span>
          </>
        );

        return (
          <li className={styles.socialItem} key={name}>
            {href ? (
              <a className={styles.socialLabel} href={href} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : undefined}>
                {label}
              </a>
            ) : (
              <span className={styles.socialLabel}>{label}</span>
            )}
            <span className={styles.separator} aria-hidden="true">✳</span>
          </li>
        );
      })}
    </ul>
  );
}

function WorkAbroadLogos({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className={`${styles.group} ${styles.logoGroup}`} aria-hidden={duplicate || undefined}>
      {workAbroadLogos.map(({ name, src, width, height, href }) => (
        <li className={styles.logoItem} key={src}>
          <a
            className={styles.logoCard}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={duplicate ? -1 : undefined}
            aria-label={`${name} (opens in a new tab)`}
            title={name}
          >
            <Image src={src} alt={name} width={width} height={height} sizes="(max-width: 700px) 112px, 132px" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CommunityMarquees() {
  return (
    <div id="community" className={styles.section}>
      <section className={styles.socialSection} aria-labelledby="social-heading">
        <div className={`container ${styles.socialHeading}`}>
          <h2 id="social-heading" className="eyebrow">Around the web</h2>
          <span>Follow us on Facebook and TikTok.</span>
        </div>
        <div className={styles.marqueeWindow} aria-label="Social channels">
          <div className={`${styles.track} ${styles.socialTrack}`}>
            <SocialIcons />
            <SocialIcons duplicate />
          </div>
        </div>
      </section>
      <section id="work-abroad-resources" className={styles.resourceSection} aria-labelledby="work-abroad-heading">
        <div className="container">
          <span className="eyebrow">Your next step, connected</span>
          <h2 id="work-abroad-heading" className={styles.resourceTitle}>Partnerships and useful links for work abroad</h2>
          <p className={styles.resourceDescription}>Explore organisations and resources for your next step abroad.</p>
        </div>
        <div className={styles.marqueeWindow} aria-label="Partnerships and work abroad resources">
          <div className={`${styles.track} ${styles.socialTrack} ${styles.logoTrack}`}>
            <WorkAbroadLogos />
            <WorkAbroadLogos duplicate />
          </div>
        </div>
      </section>
    </div>
  );
}
