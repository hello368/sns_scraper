#!/usr/bin/env python3
"""
MediSpa AI — Telegram Report Generator
DB 통계를 읽어 텔레그램 친화적인 텍스트 리포트 생성.
"""

import sys
import json
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))


def generate_report() -> str:
    from storage.repository import Repository

    repo = Repository()
    try:
        stats = repo.get_library_stats()
        recent_videos = repo.get_videos(limit=5)

        total = stats["total_videos"]
        downloaded = stats["downloaded"]
        by_cat = stats["by_category"]
        by_platform = stats["by_platform"]

        now = datetime.now().strftime("%Y-%m-%d %H:%M")

        lines = [
            f"📊 *MediSpa AI — Daily Report*",
            f"🕐 {now} KST",
            "",
            f"📈 *Overview*",
            f"   • Total Videos: `{total}`",
            f"   • Downloaded: `{downloaded}`",
            f"   • Pending: `{total - downloaded}`",
            "",
        ]

        if by_cat:
            lines.append(f"🏷️ *By Category*")
            for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
                lines.append(f"   • {cat}: `{count}`")
            lines.append("")

        if by_platform:
            lines.append(f"🌐 *By Platform*")
            for plat, count in sorted(by_platform.items(), key=lambda x: -x[1]):
                lines.append(f"   • {plat}: `{count}`")
            lines.append("")

        if recent_videos:
            lines.append(f"🆕 *Recent Videos*")
            for v in recent_videos[:5]:
                title = (v.title or "Untitled")[:60]
                lines.append(
                    f"   • [{v.platform}] {title} "
                    f"({v.relevance_score or '?'}/10)"
                )
            lines.append("")

        lines.append(f"---")
        lines.append(f"🤖 *MediSpa AI* v0.2.0")

        return "\n".join(lines)
    finally:
        repo.close()


def main():
    report = generate_report()
    print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
