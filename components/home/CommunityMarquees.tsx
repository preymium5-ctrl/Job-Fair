import Image from "next/image";
import { MessagesSquare } from "lucide-react";
import styles from "./CommunityMarquees.module.css";

const socialChannels = [
  { name: "Facebook", icon: "facebook-color" },
  { name: "Instagram", icon: "instagram-color" },
  { name: "TikTok", icon: "tiktok-color" },
  { name: "Threads", icon: "threads" },
  { name: "X", icon: "x" },
  { name: "Reddit", icon: "reddit-color" },
  { name: "Forums", icon: null },
];

function OrganizationLogos({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className={styles.group} aria-hidden={duplicate || undefined}>
      {[0, 1, 2].map((repeat) => (
        <div
          className={`${styles.organizationPair} ${repeat > 0 ? styles.repetition : ""}`}
          key={repeat}
          aria-hidden={repeat > 0 || undefined}
        >
          <div className={styles.organization}>
            <Image
              src="/images/organizations/humble-hunters.svg"
              alt="Humble Hunters"
              width={341}
              height={82}
              loading="eager"
              className={styles.humbleLogo}
            />
          </div>
          <div className={styles.organization}>
            <Image
              src="/images/organizations/piwti-seal.webp"
              alt=""
              width={88}
              height={88}
              loading="eager"
              className={styles.weldingLogo}
            />
            <span className={styles.weldingName}>
              Philippine Institute
              <br />of Welding
              <small>Technology Incorporated</small>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SocialIcons({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className={`${styles.group} ${styles.socialGroup}`} aria-hidden={duplicate || undefined}>
      {socialChannels.map(({ name, icon }) => (
        <li className={styles.socialItem} key={name}>
          <span className={styles.socialIcon} aria-hidden="true">
            {icon ? (
              <Image src={`/images/social/${icon}.svg`} alt="" width={28} height={28} loading="eager" />
            ) : (
              <MessagesSquare size={28} strokeWidth={1.7} />
            )}
          </span>
          <span className={name === "X" ? styles.screenReaderOnly : undefined}>{name}</span>
          <span className={styles.separator} aria-hidden="true">✳</span>
        </li>
      ))}
    </ul>
  );
}

export function CommunityMarquees() {
  return (
    <section id="community" className={styles.section} aria-labelledby="community-heading">
      <div className={`container ${styles.heading}`}>
        <div>
          <span className="eyebrow">People. Skills. Possibilities.</span>
          <h2 id="community-heading">Connections that <span>move us forward.</span></h2>
        </div>
      </div>

      <div className={styles.logoWindow} aria-label="Organizations">
        <div className={`${styles.track} ${styles.organizationTrack}`}>
          <OrganizationLogos />
          <OrganizationLogos duplicate />
        </div>
      </div>

      <div className={styles.socialSection}>
        <div className={`container ${styles.socialHeading}`}>
          <h3 className="eyebrow">Around the web</h3>
          <span>Our social channels are coming soon.</span>
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
