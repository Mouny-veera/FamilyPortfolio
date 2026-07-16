from abc import ABC, abstractmethod
from dataclasses import dataclass

import pandas as pd


@dataclass
class ScanScore:
    ticker: str
    score: float
    metrics: dict


class BaseStrategy(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    async def score(self, ticker: str, ohlc: pd.DataFrame) -> ScanScore | None:
        ...
