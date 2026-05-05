type SplashScreenProps = {
  fadingOut: boolean;
  showProgress: boolean;
  onFinish: () => void;
  onExited: () => void;
};

export function SplashScreen({
  fadingOut,
  showProgress,
  onFinish,
  onExited,
}: SplashScreenProps) {
  return (
    <div
      className={`splash-screen${fadingOut ? " splash-screen--hidden" : ""}`}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && fadingOut) {
          onExited();
        }
      }}
    >
      {showProgress ? <div className="splash-progress" aria-hidden="true" /> : null}
      <video
        className="splash-screen__video"
        src="/logo_anim.mp4"
        autoPlay
        muted
        playsInline
        onEnded={onFinish}
      />
    </div>
  );
}
