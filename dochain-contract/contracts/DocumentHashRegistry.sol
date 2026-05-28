// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DocumentHashRegistry {
    address public owner;

    struct DocumentRecord {
        bytes32 documentHash;
        string documentId;
        string ipfsCid;
        address recordedBy;
        uint256 recordedAt;
        bool exists;
    }

    mapping(bytes32 => DocumentRecord) private records;
    mapping(string => bytes32) private hashByDocumentId;

    event DocumentHashRecorded(
        bytes32 indexed documentHash,
        string indexed documentId,
        string ipfsCid,
        address indexed recordedBy,
        uint256 recordedAt
    );

    error EmptyDocumentId();
    error EmptyHash();
    error DocumentAlreadyRecorded(bytes32 documentHash);

    constructor() {
        owner = msg.sender;
    }

    function recordDocumentHash(
        string calldata documentId,
        bytes32 documentHash,
        string calldata ipfsCid
    ) external {
        if (bytes(documentId).length == 0) {
            revert EmptyDocumentId();
        }

        if (documentHash == bytes32(0)) {
            revert EmptyHash();
        }

        if (records[documentHash].exists) {
            revert DocumentAlreadyRecorded(documentHash);
        }

        uint256 recordedAt = block.timestamp;

        records[documentHash] = DocumentRecord({
            documentHash: documentHash,
            documentId: documentId,
            ipfsCid: ipfsCid,
            recordedBy: msg.sender,
            recordedAt: recordedAt,
            exists: true
        });

        hashByDocumentId[documentId] = documentHash;

        emit DocumentHashRecorded(
            documentHash,
            documentId,
            ipfsCid,
            msg.sender,
            recordedAt
        );
    }

    function getRecordByHash(
        bytes32 documentHash
    ) external view returns (DocumentRecord memory) {
        return records[documentHash];
    }

    function getRecordByDocumentId(
        string calldata documentId
    ) external view returns (DocumentRecord memory) {
        return records[hashByDocumentId[documentId]];
    }

    function isRecorded(bytes32 documentHash) external view returns (bool) {
        return records[documentHash].exists;
    }
}

