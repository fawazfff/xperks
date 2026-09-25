// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Testnet-only demo shares and holder benefits. Demo shares have no financial value.
contract XPerksDemo {
    uint8 public constant decimals = 18;
    uint256 public constant demoAmount = 1 ether;

    bytes32 private constant DTSLA = keccak256("dTSLA");
    bytes32 private constant DNVDA = keccak256("dNVDA");
    bytes32 private constant DAAPL = keccak256("dAAPL");
    bytes32 private constant DCOIN = keccak256("dCOIN");
    bytes32 private constant DMSFT = keccak256("dMSFT");
    bytes32 private constant DAMZN = keccak256("dAMZN");
    bytes32 private constant DMSTR = keccak256("dMSTR");

    struct Benefit {
        address creator;
        string title;
        string description;
        string asset;
        uint256 minimum;
        bool active;
    }

    uint256 public benefitCount;
    mapping(bytes32 => mapping(address => uint256)) private balances;
    mapping(bytes32 => mapping(address => bool)) private received;
    mapping(uint256 => Benefit) private benefits;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event DemoAssetClaimed(address indexed wallet, string asset, uint256 amount);
    event BenefitCreated(uint256 indexed id, address indexed creator, string asset, uint256 minimum);
    event BenefitClaimed(uint256 indexed id, address indexed wallet);
    event BenefitStatusChanged(uint256 indexed id, bool active);

    function _key(string memory asset) private pure returns (bytes32) {
        return keccak256(bytes(asset));
    }

    function isSupportedAsset(string memory asset) public pure returns (bool) {
        bytes32 key = _key(asset);
        return key == DTSLA || key == DNVDA || key == DAAPL || key == DCOIN || key == DMSFT || key == DAMZN || key == DMSTR;
    }

    function balanceOfAsset(string calldata asset, address wallet) external view returns (uint256) {
        return balances[_key(asset)][wallet];
    }

    function receivedDemoAsset(string calldata asset, address wallet) external view returns (bool) {
        return received[_key(asset)][wallet];
    }

    function claimDemoAsset(string calldata asset) external {
        require(isSupportedAsset(asset), "Unsupported demo asset");
        bytes32 key = _key(asset);
        require(!received[key][msg.sender], "Already received this demo asset");
        received[key][msg.sender] = true;
        balances[key][msg.sender] += demoAmount;
        emit DemoAssetClaimed(msg.sender, asset, demoAmount);
    }

    // Backward-compatible dTSLA helpers.
    function balanceOf(address wallet) external view returns (uint256) {
        return balances[DTSLA][wallet];
    }

    function receivedDemoShares(address wallet) external view returns (bool) {
        return received[DTSLA][wallet];
    }

    function claimDemoShares() external {
        require(!received[DTSLA][msg.sender], "Already received demo shares");
        received[DTSLA][msg.sender] = true;
        balances[DTSLA][msg.sender] += demoAmount;
        emit DemoAssetClaimed(msg.sender, "dTSLA", demoAmount);
    }

    function createBenefit(
        string calldata title,
        string calldata description,
        string calldata asset,
        uint256 minimum
    ) external returns (uint256 id) {
        require(bytes(title).length >= 3 && bytes(title).length <= 80, "Invalid title");
        require(bytes(description).length <= 320, "Description too long");
        require(isSupportedAsset(asset), "Unsupported demo asset");
        require(minimum > 0 && minimum <= demoAmount, "Invalid minimum");

        id = ++benefitCount;
        benefits[id] = Benefit(msg.sender, title, description, asset, minimum, true);
        emit BenefitCreated(id, msg.sender, asset, minimum);
    }

    function getBenefit(uint256 id) external view returns (Benefit memory) {
        require(id > 0 && id <= benefitCount, "Benefit not found");
        return benefits[id];
    }

    function claimBenefit(uint256 id) external {
        require(id > 0 && id <= benefitCount, "Benefit not found");
        Benefit storage benefit = benefits[id];
        require(benefit.active, "Benefit inactive");
        require(!hasClaimed[id][msg.sender], "Already claimed");
        require(balances[_key(benefit.asset)][msg.sender] >= benefit.minimum, "Not enough demo shares");
        hasClaimed[id][msg.sender] = true;
        emit BenefitClaimed(id, msg.sender);
    }

    function setBenefitActive(uint256 id, bool active) external {
        require(id > 0 && id <= benefitCount, "Benefit not found");
        require(msg.sender == benefits[id].creator, "Only creator");
        benefits[id].active = active;
        emit BenefitStatusChanged(id, active);
    }
}
