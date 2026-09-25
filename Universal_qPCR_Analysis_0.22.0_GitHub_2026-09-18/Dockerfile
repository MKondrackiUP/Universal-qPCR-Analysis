# The base image is a build argument so a release can be pinned to an immutable
# digest without editing this file:
#
#   docker build --build-arg NGINX_IMAGE=nginx@sha256:<digest> -t universal-qpcr-analysis .
#
# Resolve the digest for the tag you intend to ship with:
#
#   docker buildx imagetools inspect nginx:stable-alpine
#
# The floating tag below is the development default. RELEASE_PROCESS.md requires
# a digest for any build that is published or cited.
ARG NGINX_IMAGE=nginx:stable-alpine
FROM ${NGINX_IMAGE}

COPY nginx.conf /etc/nginx/nginx.conf
COPY docs/ /usr/share/nginx/html/

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
