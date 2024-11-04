# FROM node:12.10.0

# ENV HOME=/home/custom_container
# ENV GROUP_ID=1003
# ENV GROUP_NAME=custom_container
# ENV USER_ID=1003
# ENV USER_NAME=custom_container

# RUN mkdir -m 550 ${HOME} && groupadd -g ${GROUP_ID} ${GROUP_NAME} && useradd -u ${USER_ID} -g ${GROUP_ID} ${USER_NAME}

# COPY --chown=${USER_ID}:${GROUP_ID} main.js ${HOME}
# COPY --chown=${USER_ID}:${GROUP_ID} package.json ${HOME}

# RUN cd ${HOME} && npm install

# RUN chown -R ${USER_ID}:${GROUP_ID} ${HOME}

# RUN find ${HOME} -type d | xargs chmod 500
# RUN find ${HOME} -type f | xargs chmod 500

# USER ${USER_NAME}
# WORKDIR /${HOME}

# EXPOSE 8000
# ENTRYPOINT ["node", "/home/custom_container/main.js"]


# Use official Node.js image
FROM node:14-alpine

# Set environment variables for custom user and group
ENV HOME=/usr/src/app
ENV GROUP_ID=1003
ENV GROUP_NAME=ralf
ENV USER_ID=1003
ENV USER_NAME=ralf

# Ensure parent directories exist and create home directory with permissions
RUN mkdir -p /usr/src && \
    mkdir -m 550 ${HOME} && \
    addgroup -g ${GROUP_ID} ${GROUP_NAME} && \
    adduser -u ${USER_ID} -G ${GROUP_NAME} -h ${HOME} -D ${USER_NAME}

# Copy files and set ownership
COPY --chown=${USER_ID}:${GROUP_ID} package.json /package.json
COPY --chown=${USER_ID}:${GROUP_ID} main.js /main.js

# Install dependencies
RUN cd / && npm install

# Set permissions
RUN chown -R ${USER_ID}:${GROUP_ID} ${HOME} && \
    find / -type d | xargs chmod 500 && \
    find / -type f | xargs chmod 500

# Switch to non-root user
USER ${USER_NAME}

# Set working directory to root
WORKDIR /

# Expose port
EXPOSE 8000

# Run the application
ENTRYPOINT ["node", "/main.js"]

