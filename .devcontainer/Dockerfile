FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install latest neovim using pre-built binary
RUN curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz \
    && tar -C /opt -xzf nvim-linux-x86_64.tar.gz \
    && ln -s /opt/nvim-linux-x86_64/bin/nvim /usr/local/bin/nvim \
    && rm nvim-linux-x86_64.tar.gz

# Install Bun as the node user
USER node
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/node/.bun/bin:$PATH"

# Switch back to root for any remaining setup
USER root

# Ensure the node user owns their home directory
RUN chown -R node:node /home/node

# Set the default user back to node
USER node

# Set working directory
WORKDIR /workspace

# Verify bun installation
RUN bun --version
