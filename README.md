# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```

----

```javascript

Version
=======
> solidity-coverage: v0.8.4

Instrumenting for coverage...
=============================

> FFJGovernance.sol
> FFJToken.sol

Compilation:
============

Nothing to compile

Network Info
============
> HardhatEVM: v2.17.0
> network:    hardhat



  Contract: FFJ Governance
    Initialisation
      ✔ Ownership
      ✔ Transfert Ownership
    Quorum
      ✔ getQuorum()
      ✔ setQuorum + getQuorum() (332ms)
      ✔ setQuorum() `organiser` access only (59ms)
    Proposals
      ✔ getNnProposals()
      ✔ getProposalById() (106ms)
      ✔ addProposal() + getNnProposals() (51ms)
      ✔ addProposal() ; checking `start` date too close (54ms)
      ✔ addProposal() ; checking `stop` date too close (41ms)
      ✔ addProposal() ; fields length (minimum) (153ms)
      ✔ addProposal() ; fields length (maximum) (147ms)
      ✔ Date range : get, set & access
      ✔ Status update (162ms)
    Token
      ✔ Token : read quantity from `accounts`
      ✔ Token : read name & symbol from an `account`
    Vote
      ✔ check access by proposal status (106ms)
      ✔ check access drived by bad parameters (52ms)
      ✔ vote for an OPENED proposal (123ms)
      ✔ drive by life cycle (151ms)


  20 passing (3s)

--------------------|----------|----------|----------|----------|----------------|
File                |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
--------------------|----------|----------|----------|----------|----------------|
 contracts/         |    92.06 |    85.71 |    91.67 |    94.94 |                |
  FFJGovernance.sol |    93.22 |    85.71 |       95 |       96 |    153,154,192 |
  FFJToken.sol      |       75 |      100 |       75 |       75 |             33 |
--------------------|----------|----------|----------|----------|----------------|
All files           |    92.06 |    85.71 |    91.67 |    94.94 |                |
--------------------|----------|----------|----------|----------|----------------|

> Istanbul reports written to ./coverage/ and ./coverage.json

```
