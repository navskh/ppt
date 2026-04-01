#!/bin/bash
# 다운로드 폴더의 scripts.js를 프로젝트에 복사하고 push
DOWNLOAD=~/Downloads/scripts.js
TARGET=~/Toy/ppt/ai-prompt-management/scripts.js

if [ ! -f "$DOWNLOAD" ]; then
  echo "❌ ~/Downloads/scripts.js 가 없습니다. 에디터에서 'JSON 내보내기' 먼저 해주세요."
  exit 1
fi

cp "$DOWNLOAD" "$TARGET"
rm "$DOWNLOAD"

cd ~/Toy/ppt
git add ai-prompt-management/scripts.js
git commit -m "update: 발표 스크립트 수정"
git push

echo "✅ scripts.js 반영 + push 완료"
