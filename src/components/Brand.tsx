import Image from 'next/image';

export default function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/logo-small.png"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-md"
      />
      <span>
        LAUNCHED<span className="text-blue-600">.</span>
      </span>
    </span>
  );
}
