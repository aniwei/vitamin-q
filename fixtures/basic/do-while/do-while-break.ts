let i = 0;
do {
    i++;
    if (i === 1) continue;
    console.log(i);
    if (i === 3) break;
} while (i < 5);
