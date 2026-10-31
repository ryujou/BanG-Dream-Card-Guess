import { Link } from "react-router-dom";
export function Star({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M50 2 64 34 99 37 72 60 81 96 50 77 19 96 28 60 1 37 36 34Z M50 27 43 44 25 44 39 56 35 74 50 64 66 74 61 55 76 44 58 43Z"
      />
    </svg>
  );
}
export function Brand({ name = "BanG Dream!", to = "/" }: { name?: string; to?: string }) {
  return (
    <Link className="brand" to={to} aria-label={`湘潭 ${name} 同好会首页`}>
      <Star />
      <span>
        <b>
          <img
            className="xiangtan-wordmark"
            src="/brand/xiangtan-wordmark.svg"
            alt="湘潭"
          />{" "}
          <em>{name}</em> 同好会
        </b>
        <small>XIANGTAN · {name === "蔚蓝档案" ? "STORIES CONNECT US" : "MUSIC CONNECTS US"}</small>
      </span>
    </Link>
  );
}
