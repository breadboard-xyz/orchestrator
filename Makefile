kube.version:
	kubectl --kubeconfig ./secret/kube/config.yml version

kube.nodes:
	kubectl --kubeconfig ./secret/kube/config.yml get nodes