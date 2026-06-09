// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DocumentHashRegistry {
    address public owner;

    struct DocumentRecord {
        bytes32 documentHash;
        string ipfsCid;
        address issuer;
        uint256 issuedAt;
        bool revoked;
        uint256 revokedAt;
        bytes32 revokeReasonHash;
        bool exists;
    }

    mapping(address => bool) public issuers;
    mapping(bytes32 => DocumentRecord) private recordsByHash;

    event IssuerUpdated(address indexed issuer, bool allowed);

    event DocumentRegistered(
        bytes32 indexed documentHash,
        string ipfsCid,
        address indexed issuer,
        uint256 issuedAt
    );

    event DocumentRevoked(
        bytes32 indexed documentHash,
        address indexed revokedBy,
        uint256 revokedAt,
        bytes32 revokeReasonHash
    );

    error OnlyOwner();
    error OnlyIssuer();
    error EmptyHash();
    error DocumentAlreadyRegistered(bytes32 documentHash);
    error DocumentNotFound(bytes32 documentHash);
    error DocumentAlreadyRevoked(bytes32 documentHash);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }
        _;
    }

    modifier onlyIssuer() {
        if (!issuers[msg.sender]) {
            revert OnlyIssuer();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        issuers[msg.sender] = true;
        emit IssuerUpdated(msg.sender, true);
    }

    function setIssuer(address issuer, bool allowed) external onlyOwner {
        issuers[issuer] = allowed;
        emit IssuerUpdated(issuer, allowed);
    }

    function registerDocument(
        bytes32 documentHash,
        string calldata ipfsCid
    ) external onlyIssuer {
        if (documentHash == bytes32(0)) {
            revert EmptyHash();
        }

        if (recordsByHash[documentHash].exists) {
            revert DocumentAlreadyRegistered(documentHash);
        }

        uint256 issuedAt = block.timestamp;

        recordsByHash[documentHash] = DocumentRecord({
            documentHash: documentHash,
            ipfsCid: ipfsCid,
            issuer: msg.sender,
            issuedAt: issuedAt,
            revoked: false,
            revokedAt: 0,
            revokeReasonHash: bytes32(0),
            exists: true
        });

        emit DocumentRegistered(
            documentHash,
            ipfsCid,
            msg.sender,
            issuedAt
        );
    }

    function revokeDocument(
        bytes32 documentHash,
        bytes32 revokeReasonHash
    ) external onlyIssuer {
        DocumentRecord storage record = recordsByHash[documentHash];

        if (!record.exists) {
            revert DocumentNotFound(documentHash);
        }

        if (record.revoked) {
            revert DocumentAlreadyRevoked(documentHash);
        }

        record.revoked = true;
        record.revokedAt = block.timestamp;
        record.revokeReasonHash = revokeReasonHash;

        emit DocumentRevoked(
            documentHash,
            msg.sender,
            record.revokedAt,
            revokeReasonHash
        );
    }

    function getRecordByHash(
        bytes32 documentHash
    ) external view returns (DocumentRecord memory) {
        return recordsByHash[documentHash];
    }

    function isRecorded(bytes32 documentHash) external view returns (bool) {
        return recordsByHash[documentHash].exists;
    }

    function isRevoked(bytes32 documentHash) external view returns (bool) {
        return recordsByHash[documentHash].revoked;
    }
}
