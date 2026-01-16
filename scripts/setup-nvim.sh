#!/usr/bin/env bash
set -euo pipefail

# Prime lazy.nvim and install plugins, then ensure Mason tools are installed.
nvim --headless "+Lazy sync" +qall
nvim --headless "+MasonInstall vtsls" +qall
