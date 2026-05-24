// Декоративный «взрыв искр» для hero-секций. 60 элементов с CSS custom properties.
const SPARKS = Array.from({ length: 60 }, (_, i) => ({
  ang: (i * 360) / 60 + (i % 3) * 4,
  len: 80 + ((i * 37) % 220),
  dist: 50 + ((i * 17) % 40),
  dur: 3 + ((i * 13) % 40) / 10,
  delay: ((i * 23) % 40) / 10,
}));

export function SparkBurst() {
  return (
    <div className="spark-burst" aria-hidden="true">
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="spark"
          style={{
            ["--ang" as string]: `${s.ang}deg`,
            ["--len" as string]: `${s.len}px`,
            ["--dist" as string]: `${s.dist}vmax`,
            ["--dur" as string]: `${s.dur}s`,
            ["--delay" as string]: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
