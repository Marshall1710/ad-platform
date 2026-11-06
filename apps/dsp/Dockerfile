FROM golang:1.27.3-alpine AS build
WORKDIR /src
COPY apps/dsp/go.mod ./
COPY apps/dsp/cmd ./cmd
RUN CGO_ENABLED=0 go build -trimpath -o /out/dsp ./cmd/dsp

FROM scratch
COPY --from=build /out/dsp /dsp
EXPOSE 8080
ENTRYPOINT ["/dsp"]
