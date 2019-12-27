FROM envoyproxy/envoy

COPY ./api_descriptor.pb /data/api_descriptor.pb
COPY ./docker/envoy/envoy.yaml /etc/envoy/envoy.yaml

EXPOSE 8080

CMD /usr/local/bin/envoy -c /etc/envoy/envoy.yaml -l debug --base-id 1235
