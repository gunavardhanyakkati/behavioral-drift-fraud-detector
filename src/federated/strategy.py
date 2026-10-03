import numpy as np

def fedavg_aggregate(weights_results):
    """
    Weighted FedAvg parameter aggregation.
    weights_results: list of tuples (client_weights_list, num_examples)
    """
    total_samples = sum(num_samples for _, num_samples in weights_results)
    if total_samples == 0:
        return weights_results[0][0]

    # Initialize aggregated weights with zeros matching shape of first client's weights
    first_weights = weights_results[0][0]
    aggregated_weights = [np.zeros_like(w, dtype=np.float32) for w in first_weights]

    for client_weights, num_samples in weights_results:
        weight_factor = num_samples / total_samples
        for i, layer_w in enumerate(client_weights):
            aggregated_weights[i] += layer_w * weight_factor

    return aggregated_weights
