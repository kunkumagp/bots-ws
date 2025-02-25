console.log(calculateNextStake(0.35+0.55+1.14));


function calculateNextStake(totalLoss, returnPercentage = 0.94) {
    // The next stake should be such that its profit (stake * returnPercentage) covers the total loss
    // return (totalLoss / returnPercentage) + Number(amountPutForTrading);
    let amountPutForTrading = 0.35;

    totalLoss = Math.abs(totalLoss);

    console.log('next Stake: ', (totalLoss / returnPercentage));

    return (totalLoss / returnPercentage) + (Number(amountPutForTrading)/2);
}