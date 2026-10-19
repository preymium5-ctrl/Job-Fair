import Image from "next/image";
import { MessagesSquare } from "lucide-react";
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

export function CommunityMarquees() {
  return (
    <section id="community" className={styles.section} aria-labelledby="social-heading">
      <div className={styles.socialSection}>
        <div className={`container ${styles.socialHeading}`}>
          <h2 id="social-heading" className="eyebrow">Around the web</h2>
          <span>Follow us on Facebook and TikTok.</span>
        </div>
        <div className={styles.socialWindow} aria-label="Social channels">
          <div className={`${styles.track} ${styles.socialTrack}`}>
            <SocialIcons />
            <SocialIcons duplicate />
          </div>
        </div>
      </div>
    </section>
  );
}
