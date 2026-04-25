// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ArcadeAdAuction
/// @notice Minimal Arc proof layer for agent-bid game ads.
/// @dev Circle x402 handles paid API access; this contract records auction actions on Arc.
contract ArcadeAdAuction {
    struct Surface {
        address owner;
        uint256 minBidMicros;
        uint256 maxBidMicros;
        bool active;
    }

    event SurfaceRegistered(
        bytes32 indexed surfaceId,
        address indexed owner,
        uint256 minBidMicros,
        uint256 maxBidMicros
    );

    event BidRecorded(
        bytes32 indexed surfaceId,
        bytes32 indexed roundId,
        bytes32 indexed bidId,
        address bidder,
        uint256 amountMicros,
        string agentId,
        string promptHash
    );

    event BidIncreased(
        bytes32 indexed surfaceId,
        bytes32 indexed roundId,
        bytes32 indexed bidId,
        address bidder,
        uint256 newAmountMicros
    );

    event PlacementFinalized(
        bytes32 indexed surfaceId,
        bytes32 indexed roundId,
        bytes32 indexed bidId,
        string imageHash,
        string receiptUri
    );

    mapping(bytes32 => Surface) public surfaces;
    mapping(bytes32 => uint256) public bidAmountsMicros;

    error NotSurfaceOwner();
    error SurfaceNotActive();
    error BidOutOfRange();
    error BidNotFound();

    function registerSurface(
        bytes32 surfaceId,
        uint256 minBidMicros,
        uint256 maxBidMicros
    ) external {
        surfaces[surfaceId] = Surface({
            owner: msg.sender,
            minBidMicros: minBidMicros,
            maxBidMicros: maxBidMicros,
            active: true
        });

        emit SurfaceRegistered(surfaceId, msg.sender, minBidMicros, maxBidMicros);
    }

    function recordBid(
        bytes32 surfaceId,
        bytes32 roundId,
        bytes32 bidId,
        uint256 amountMicros,
        string calldata agentId,
        string calldata promptHash
    ) external {
        Surface memory surface = surfaces[surfaceId];
        if (!surface.active) revert SurfaceNotActive();
        if (amountMicros < surface.minBidMicros || amountMicros > surface.maxBidMicros) {
            revert BidOutOfRange();
        }

        bidAmountsMicros[bidId] = amountMicros;
        emit BidRecorded(surfaceId, roundId, bidId, msg.sender, amountMicros, agentId, promptHash);
    }

    function recordBidIncrease(
        bytes32 surfaceId,
        bytes32 roundId,
        bytes32 bidId,
        uint256 newAmountMicros
    ) external {
        Surface memory surface = surfaces[surfaceId];
        if (!surface.active) revert SurfaceNotActive();
        if (bidAmountsMicros[bidId] == 0) revert BidNotFound();
        if (newAmountMicros < bidAmountsMicros[bidId] || newAmountMicros > surface.maxBidMicros) {
            revert BidOutOfRange();
        }

        bidAmountsMicros[bidId] = newAmountMicros;
        emit BidIncreased(surfaceId, roundId, bidId, msg.sender, newAmountMicros);
    }

    function finalizePlacement(
        bytes32 surfaceId,
        bytes32 roundId,
        bytes32 bidId,
        string calldata imageHash,
        string calldata receiptUri
    ) external {
        Surface memory surface = surfaces[surfaceId];
        if (msg.sender != surface.owner) revert NotSurfaceOwner();
        if (bidAmountsMicros[bidId] == 0) revert BidNotFound();

        emit PlacementFinalized(surfaceId, roundId, bidId, imageHash, receiptUri);
    }
}
