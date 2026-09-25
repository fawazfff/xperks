// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Testnet-only demo shares and holder benefits. Shares have no financial value.
contract XPerksDemo {
    string public constant name = "Demo Tesla Shares";
    string public constant symbol = "dTSLA";
    uint8 public constant decimals = 18;
    uint256 public constant demoAmount = 1 ether;

    struct Benefit {
        address creator;
        string title;
        string description;
        string reward;
        uint256 minimum;
        bool active;
    }

    uint256 public benefitCount;
    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public receivedDemoShares;
    mapping(uint256 => Benefit) private benefits;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event DemoSharesClaimed(address indexed wallet, uint256 amount);
    event BenefitCreated(uint256 indexed id, address indexed creator, uint256 minimum);
    event BenefitClaimed(uint256 indexed id, address indexed wallet);

    function claimDemoShares() external {
        require(!receivedDemoShares[msg.sender], "Already received demo shares");
        receivedDemoShares[msg.sender] = true;
        balanceOf[msg.sender] += demoAmount;
        emit DemoSharesClaimed(msg.sender, demoAmount);
    }

    function createBenefit(
        string calldata title,
        string calldata description,
        string calldata reward,
        uint256 minimum
    ) external returns (uint256 id) {
        require(bytes(title).length >= 3 && bytes(title).length <= 80, "Invalid title");
        require(bytes(description).length <= 320, "Description too long");
        require(bytes(reward).length > 0 && bytes(reward).length <= 500, "Invalid reward");
        require(minimum > 0 && minimum <= demoAmount, "Invalid minimum");
        id = ++benefitCount;
        benefits[id] = Benefit(msg.sender, title, description, reward, minimum, true);
        emit BenefitCreated(id, msg.sender, minimum);
    }

    function getBenefit(uint256 id) external view returns (Benefit memory) {
        require(id > 0 && id <= benefitCount, "Benefit not found");
        return benefits[id];
    }

    function claimBenefit(uint256 id) external {
        require(id > 0 && id <= benefitCount, "Benefit not found");
        require(benefits[id].active, "Benefit inactive");
        require(!hasClaimed[id][msg.sender], "Already claimed");
        require(balanceOf[msg.sender] >= benefits[id].minimum, "Not enough demo shares");
        hasClaimed[id][msg.sender] = true;
        emit BenefitClaimed(id, msg.sender);
    }

    function setBenefitActive(uint256 id, bool active) external {
        require(id > 0 && id <= benefitCount, "Benefit not found");
        require(msg.sender == benefits[id].creator, "Only creator");
        benefits[id].active = active;
    }
}
