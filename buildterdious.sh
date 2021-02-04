#!/bin/sh

npm run build-front
rm -rf ./static
cp -R ./front/build ./static
docker buildx create --name gladysbuilder && docker buildx use gladysbuilder
docker login
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker buildx build --platform linux/arm/v6 --push -f docker/Dockerfile.buildx -t "terdious/gladys:pro" .